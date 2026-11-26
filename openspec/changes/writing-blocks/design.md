# Design

## Context

See proposal.md for why, and the `writing-blocks` spec for behaviour.

Current state that shapes the approach:
- **Keep the Rhythm 0.2.16** counts a note's whole raw text on every `editor-change` and logs the net difference (read from its `main.js`). Its "Don't count comments" setting (`settings.ignoreComments` in its `data.json`) strips `%% … %%` before counting. It is off in `test-vault`.
- **`countWords`** (`src/wordcount.ts`) already strips `%% … %%`, but counts the `[!writing]` header line.
- **`workSection`** (`src/became.ts`, private) returns the Work section raw. **`splitScenes`** (`src/promote.ts`) splits at `#`–`###` headings and `***`/`---`/`___` lines, including any inside comments.
- The exercise template's `## Work` section is empty (`src/templates.ts`).
- Inkwell has no CodeMirror code yet. `@codemirror/state`, `view` and `language` are already external in `esbuild.config.mjs`.

## Goals / Non-Goals

**Goals:**
- All block logic in one pure module, unit-tested without Obsidian.
- Typing is never rewritten or intercepted except where the spec makes the block read-only, so phone keyboards, autocorrect and dictation behave normally.
- The block's format leaves room for later features (types of block, the timer inside blocks) without changing the format already in notes.
- Writing blocks are a self-contained component inside Inkwell (decision 10), so they could become their own plugin later. Splitting them out is not planned.

**Non-Goals:**
- Source mode gets no decorations: it shows the raw Markdown.
- No support for writing blocks nested in lists or other callouts.

## Decisions

**1. Format: a callout, with the first draft in a comment below it** ([ADR 0006](../../decisions/0006-writing-block-first-draft-in-a-comment.md)).
```
> [!writing] Opening
> I have come back before.

%% writing-block first-draft review
I have been here before.
%%
```
- One blank line separates them. Without it, Markdown's lazy continuation would pull the comment into the callout.
- The opening line carries the mode (`writing`, `review`, `edited`; shown as Draft, Review and Edited, and the stored word `writing` is kept so the format never changes for a label), so a mode switch only edits a word inside a comment. KTR counts nothing for it, and the note stays the source of truth across devices.
- The first draft is stored as plain lines, one paragraph per line, as in the block.
- Later block types can go in the callout's metadata (`[!writing|freewrite]`) without changing this format.
- Alternatives (see the ADR): separate history notes, which the writer rejected; inline CriticMarkup, which KTR counts and which means intercepting keystrokes; depending on Simple Track Changes, which is too new.

**2. Pure core: `src/writingblocks.ts`.** It finds blocks and their comments with line ranges, reads and sets the mode, builds the comment, wraps a selection or tabbed run, `unwrapBlocks(text)` (each block → its current prose, comment removed), `countable(text)` for word counts, and `diffSegments(before, after)`. Callers only apply its results: an editor transaction, `vault.process`, or a render.

**3. Diff: `presentableDiff` from `@codemirror/merge`.** Run on the unwrapped prose of the first draft and the current text, then mapped to document positions through each line's prefix offset. It is character-based but aligns changes to word boundaries, which reads well for prose. A `scanLimit` and `timeout` bound the work on long, heavily rewritten blocks. Only `presentableDiff` is imported. Measured in task 1.4 (`@codemirror/merge` 6.13.0, minified, same externals as `main.js`): **7.2 KB**, under the 10 KB limit, so the library stays. At runtime it uses Obsidian's own `@codemirror/state`, `view`, `language` and `@lezer/highlight`; the dev dependencies are pinned to the versions `obsidian` 1.13.0 types use (state 6.5.0, view 6.38.6). Alternative: write the diff ourselves. That's more code and more edge cases for the same result.

**4. Live Preview: `src/writingblockeditor.ts`** (`registerEditorExtension`, gated on `editorLivePreviewField`).
- **Cursor outside the block:** Obsidian renders the callout through post processors, so the reading-view code (decision 5) handles it.
- **Cursor inside the block:** a `StateField` builds decorations from the pure parse. The writer sees only the writing, styled like the rendered block (task 2.1 found Obsidian shows the raw `> [!writing]` and `>` here, which the writer doesn't want).
  - Every block line gets `Decoration.line` with a class for the box, monospace font and first-line indent.
  - The header line's text and each line's `> ` are `Decoration.replace` ranges, also given to `EditorView.atomicRanges`, so the cursor and arrow keys skip them and a click never lands inside. On the header line the hidden range is a widget: the block's toolbar (decision 9).
  - A keymap at high precedence, active only inside a block, owns Enter (new `> ` line; on an empty last line, remove it and leave the block) and Backspace (at a paragraph's start, join it to the previous line; on the only empty line, remove the block). Other keys are untouched.
  - Review: inserted ranges get `Decoration.mark`, and removed text is a struck-through `Decoration.widget`. The diff is debounced (about 150 ms), and decorations are mapped through edits in between.
  - Writing after review: the block is replaced by a block widget showing the first draft. A `transactionFilter` drops `input`/`delete` user events that touch that range and shows the notice. This, and the keymap above, are the only places Inkwell handles keys.
  - Every reviewed mode: the comment collapses to a small "First draft kept" widget.
- Mode switches and the first review are single editor transactions with their own `userEvent`, so undo reverses them.
- **Fallback:** if Obsidian's own callout handling fights the hidden Markdown, the block could use today's tab-indented text as its format instead, at the cost of links and emphasis inside the writing (Markdown treats it as code). That would need ADR 0006 revised before archiving.

**5. Reading view and rendered callouts: `src/writingblockview.ts`** (`registerMarkdownPostProcessor` for `.callout[data-callout="writing"]`).
- Gets the full note text from `ctx.getSectionInfo(el)` and finds the comment below the section.
- Replaces the callout title with the block's toolbar (decision 9).
- Review shows the diff. Writing after review renders the first draft.
- Splits paragraphs at `<br>` so each line gets the first-line indent. With "Strict line breaks" on, Obsidian joins lines, so the block uses one paragraph per line regardless.
- Toolbar mode picks in reading view use `vault.process`. It re-finds the block by line number and checks the text matches before writing, and otherwise shows a notice and changes nothing. DOM via `createEl` only.

**6. Commands** (`src/main.ts`, also on `editor-menu`): "New writing block", "Draft mode", "Review mode", "Edited mode". Mode commands use `editorCheckCallback` and show only with the cursor in a block. No default hotkeys.

**7. KTR: `ignoresComments(): boolean | null`** in `src/integrations/keep-the-rhythm.ts`. It reads `settings.ignoreComments` from the same version-gated `data.json` read, and returns null when KTR is missing or untested (no notice). Read-only, as ADR 0002 requires.

**8. Existing code:**
- `countWords` drops writing header lines before counting; comments are already dropped.
- `workSection` passes its result through `unwrapBlocks` and is exported for tests.
- `promoteToLongForm` calls `unwrapBlocks` on the draft body before `splitScenes`. The original draft is still moved, untouched, into `Archive/` first.

**9. The block toolbar, built for more than one kind of block.** One toolbar component draws into both places a block appears: the callout title (rendered, decision 5) and the header-line widget (editing, decision 4). So it looks the same in each, and is always visible, as the spec requires. What it shows comes from a block type definition: the modes and the tools for each mode. Only the writing block type exists in this change. Its modes are Draft, Review and Edited, and it has no tools yet. The timer (idea `writing-block-timer`) will be the first tool, and other types (idea `writing-block-types`) add definitions rather than new toolbars. The type is read from the callout's metadata (`[!writing|<type>]`), defaulting to the writing type, so notes written now never need rewriting. The toolbar holds only controls, never writing, and KTR counts nothing in it.

**10. Writing blocks are a component, used by the rest of Inkwell.** Capture, Practice and the writing modes are Inkwell's platform. Writing blocks are a core component that supports features in them: exercises start with one, This Became a Story and Promote read them, and the timer will appear in their toolbar.
- **Dependencies run one way.** `src/writingblock*.ts` import only Obsidian, CodeMirror and each other, never Practice, stories, projects, the timer or settings.
- **Other parts plug in.** They call the blocks' functions (`unwrapBlocks`, `findBlocks`), and later register toolbar tools and block types. Blocks never call into them.
- **Lint keeps it true.** An ESLint `no-restricted-imports` rule for `src/writingblock*.ts` fails on any other Inkwell import.

The blocks could then become their own plugin without untangling them. A split is not planned: one plugin is simpler to install and to keep in step.

**Mobile and sync:**
- **Mobile:** everything is in the note. No desktop-only APIs. Typing is never rewritten. The block's toolbar is the touch path, and the commands work from the palette and the editor menu.
- **Sync:** modes and the first draft sync with the note. Two devices editing one block at once is an ordinary sync conflict on a text file; nothing else stores block state.

**Tests:**
- Unit (`tests/writingblocks.test.ts`): parse, modes, comment format, wrap and convert, unwrap, countable, diff segments. Invariant: rebuilding the first draft from the segments gives it back exactly.
- Fake vault: "This became a story" (`tests/became.test.ts`) and promote (`tests/promote.test.ts`), including the original being kept first.
- By hand in `test-vault` on desktop and a phone: Live Preview decorations, read-only Draft mode, the toolbar in reading view and Live Preview.

## Risks / Trade-offs

- [Obsidian swaps its rendered callout for the source when the cursor enters, so the box could jump] → the editing decorations and the rendered callout share one set of CSS rules, checked by clicking in and out (task 2.6).
- [The keymap and atomic prefixes interfere with phone keyboards] → no rewriting of typed text, only Enter and Backspace at line edges; checked on a phone with autocorrect, swipe and dictation (task 2.6).
- [The first draft counts as new KTR words if "Don't count comments" is off] → notice on first review; documented in the README. KTR doesn't recount old history when the setting changes.
- [Decorations fight Obsidian's own callout rendering in Live Preview] → only decorate while the cursor is inside; otherwise rely on the post processor. Checked by hand.
- [Long blocks make the diff slow] → debounce, `scanLimit`/`timeout`; checked with a 5,000-word block.
- [Hand edits damage the comment] → treated as never reviewed and never rewritten (spec); the text stays in the note.
- [Writing that contains `%%`] → review refused with a notice (spec).

## Migration Plan

Nothing to migrate: tabbed blocks convert on request with "New writing block". To roll back, remove the feature: blocks stay readable callouts, and first drafts stay hidden comments.

## Open Questions

- Exact colours for added and removed text: chosen in the CSS task with Obsidian's variables, checked in light and dark themes.
