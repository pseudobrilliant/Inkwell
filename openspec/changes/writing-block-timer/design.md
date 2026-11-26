# Design

## Context

- **Timer today** (`src/timer.ts`, `src/timerstate.ts`, spec `writing-timer`): one device-local `TimerState` keyed by note `path` (ADR 0003). The `editor-change` event marks a keystroke when its file is the timed note. The timer is drawn in the status bar and as a header button with a menu, and redrawn every second.
- **Blocks today** (`openspec/changes/writing-blocks`, not yet archived): `renderToolbar(container, block, onPick)` draws the modes in two places. In Live Preview, `ToolbarWidget`, a CodeMirror widget, draws it on the header line while the cursor is in the block, and `renderedToolbars` draws it in Obsidian's rendered callout. In reading view, the post processor in `src/writingblockview.ts` draws it. Design decision 9 planned tools in this toolbar, and decision 10 says `src/writingblock*.ts` never import the rest of Inkwell (lint enforces it). Inkwell plugs in through `WritingBlockHost` (`src/blockhost.ts`). `onFirstDraftSaved()` already fires on a block's first review, but it doesn't say which note.
- **Purity helpers that already exist:** `findBlocks`, and `writingAt(text, pos)` (in a block's writing and free to edit). Neither one says whether the block is in Draft before review.

## Goals / Non-Goals

**Goals:**
- The timer becomes the first toolbar tool, with no import from block code into the timer or the other way round.
- Decide "does this keystroke count" with pure functions, tested without Obsidian.
- The clock ticks in the toolbar without rebuilding editor decorations every second.

**Non-Goals:**
- A general tool framework, or block types. Only what the timer needs: tools for some modes, rendered in both toolbar places. Idea `writing-block-types` generalizes it later.
- Any change to `TimerState`'s stored shape.

## Decisions

**1. Tools come from the host, not the block type.** `WritingBlockHost` gains `tools: BlockTool[]`:
```ts
interface BlockTool {
  id: string;
  /** Draw into `el` for this block, or leave it empty. Called on each toolbar draw. */
  render(el: HTMLElement, ctx: { sourcePath: string; block: WritingBlock }): void;
}
```
`renderToolbar` gets the context and draws each tool into its own `span.inkwell-wb-tool`, before the modes. The tool decides for itself whether to show anything. Block code knows nothing about exercises, timers or modes the tool cares about.
- *Alternative:* list tools per mode on `BlockType` (as decision 9 sketched). That pushes Inkwell's rules ("exercises only", "Draft before review") into the block type, which belongs to the blocks. It can still be added when `writing-block-types` lands, because the host list can feed it.

**2. The source path reaches the toolbar.** In Live Preview, both `ToolbarWidget.toDOM` and `renderedToolbars` read `view.state.field(editorInfoField).file?.path`. Reading view uses `ctx.sourcePath`. With no path (an embed with no file), no tools are drawn.

**3. The first-review callback says where.** `onFirstDraftSaved()` becomes `onFirstDraftSaved({ sourcePath, text })`, where `text` is the note's text after the switch. All three switch paths have both:
- `switchInView`: `editorInfoField`, and the new doc
- `switchInEditor`: the command callback passes the view's file
- `switchInFile`: the `TFile`, and the processed text

The host then shows the KTR notice as today and calls `timer.blockReviewed(sourcePath, text)`. Passing the text avoids re-reading a note whose editor hasn't saved yet.

**4. Pure decisions in `src/timerstate.ts`** (it already holds the timer's pure logic; block parsing comes from `src/writingblocks.ts`, which Inkwell may import):
- `drafting(block)` in `src/writingblocks.ts`: `mode === "writing" && !firstDraft`. Also `draftingAt(text, pos)`, built on the same body-line lookup as `writingAt`.
- `timing(type, text): "note" | "block" | "none"`. An exercise with blocks is `block`. An exercise or journal without blocks is `note`. Anything else is `none`. `hasDraftLeft(text)` says whether any block is still drafting.
- `countsAsTyping(timing, text, pos)`: `note` gives true; `block` gives `draftingAt`.
- `afterFirstReview(state, path, text): { log: boolean; rearmGoal: number | null }`.
- `goalProgress(state, now): number | null`: elapsed divided by the goal, capped at 1; null with no goal.

**5. `timer.ts` wiring:**
- `onType` takes the editor: `countsAsTyping(timing(type, editor.getValue()), text, editor.posToOffset(editor.getCursor()))`. That runs `findBlocks` on each keystroke in the timed note only. Exercises are short, and the parse is linear.
- `arm` on opening an exercise reads the note (`cachedRead`) and skips it when blocks exist and `!hasDraftLeft`. Creating a new exercise always arms it (the template's block is empty and in Draft).
- `blockReviewed(path, text)`: if the timer's path matches, `stop()`, then re-arm with the same goal when `hasDraftLeft(text)`. This re-arm ignores "Time practice writing": the writer is already using a timer in this note.
- Header button: `render()` skips it for a note timed by block. Which notes those are is kept in an in-memory `Map<path, timing>`, filled from the `editor-change` text and from `cachedRead` when a timed note is opened or the timer is restored. It is never persisted, so ADR 0003's stored state is unchanged.

**6. The tool ticks itself; editor widgets are not rebuilt.** The timer tool's `render` creates its element (ring SVG plus a time span), tags it with the source path, and adds it to a `Set` the timer owns. The 1-second tick updates the text and ring of every element in the set and drops any that are `!isConnected`. `ToolbarWidget.eq` doesn't change, so CodeMirror keeps the widget and its DOM. A change in which note has the timer (arm, stop, discard) is shown the same way: the element hides itself when the timer isn't for its note. That keeps one rule for "another note's timer: show nothing".

**7. The ring is SVG drawn with `createSvg`.** Two circles, the track and the arc. Progress is set through the arc's `stroke-dashoffset` *attribute* (not `el.style`, which the plugin rules forbid), with `pathLength="100"` so the offset is simply `100 − progress·100`. Colors come from Obsidian variables in `styles.css` (`--text-faint` for the track, `--interactive-accent` for the arc, `--text-muted` when paused). With no goal, the SVG isn't drawn.
- *Alternative:* a CSS `conic-gradient` driven by a custom property. Setting that needs `el.style.setProperty`, which lint rejects.

**8. Tap opens the menu.** This is the same `menu()` the header button uses, so mobile and desktop behave alike, and a tap never starts or pauses by accident. When no timer exists, the tool shows a quiet timer icon, and its menu offers only "Start now" (the same path as the "Start or pause writing timer" command).

**Mobile:** no new APIs. The toolbar tool is the touch path that replaces the header button in block-timed exercises. The menu works by tap. On phones the status bar doesn't exist, so the toolbar is the only place the timer shows there, which is why it carries the full menu.

**Sync:** nothing new syncs. The timer state stays device-local (ADR 0003). Minutes go to `writing_min` through `processFrontMatter` as today. A first review on one device stops only that device's timer. Another device's timer for the same note keeps its own time, and logs it when stopped, exactly like two devices timing one exercise today.

**Tests:**
- Pure (`tests/writingblocks.test.ts`, `tests/timerstate.test.ts`): `drafting`/`draftingAt`, `timing`, `countsAsTyping`, `hasDraftLeft`, `afterFirstReview`, `goalProgress`.
- Fake vault (`tests/timer.test.ts`, new): `blockReviewed` logs to `writing_min`, re-arms when a Draft block remains, and leaves other notes' timers alone. `fakePlugin()` needs `addStatusBarItem` and the workspace `on` stubs that `WritingTimer`'s constructor uses.
- By hand in `test-vault`, desktop and phone: the ring in Live Preview (cursor in and out) and reading view, no header button, the status bar, and the menu.

## Risks / Trade-offs

- [The tool's DOM is replaced when Obsidian re-renders a callout, leaving stale elements in the set] → the set is pruned by `isConnected` on each tick. A re-render calls `render` again and adds the new element.
- [Cursor position at `editor-change` is after the keystroke. A keystroke that ends the block's last line, or a paste spanning out of the block, might be judged by where the cursor lands] → counting is only about starting or resuming and the idle clock, so one misjudged key moves time by under a second. `draftingAt` uses the same body-line rule the blocks use, so typing in the block is judged right.
- [Typing in a Draft block of a note that isn't an exercise looks like it should time] → the spec says no timer shows there, so nothing suggests it would.
- [A first review done by hand (editing the comment in source mode) doesn't fire the callback] → the timer keeps going until the idle pause or a stop. This is rare, and no time is wrongly added.
- [Re-arming after review ignores "Time practice writing"] → only after the writer already had a timer on this note, where turning it off mid-exercise would be surprising.

## Migration Plan

Nothing to migrate. Stored timers keep their shape. Exercises made before writing blocks have no block, so they keep the note timer. To roll back, remove the tool from the host: the toolbar shows only the modes again, and the header button comes back, since `timing` is the only switch.
