# Design

## Context

See proposal.md for why, and the two spec deltas for the behaviour. Relevant state today:

- `HEADER` in `src/writingblocks.ts` already accepts metadata (`[!writing|…]`) and drops it. `WritingBlock` has no type or options.
- Blocks are built by `blockLines`, `emptyBlock`, `wrapLines`, `convertTabbed` (all `> [!writing]`), and `newBlockAt` and `putInBlock`, which use them. `putInBlock` keeps an empty template block's own header and fills its lines.
- Inkwell makes blocks in `src/templates.ts` (journal, exercise, story draft), `src/projects.ts` (`emptyBlock` for a new scene), `src/promote.ts` (`wrapLines` per scene), `src/stories.ts` (`putInBlock` into the draft template, for "This became a story") and `src/blockhost.ts` (`wrapBody`, "Put in a writing block").
- `src/writingblocktoolbar.ts` already has `BlockType { id, modes }`, `WRITING_BLOCK`, and `blockTypeOf(block)`, which always returns `WRITING_BLOCK`. `renderToolbar` draws `blockTypeOf(block).modes`, then the host's tools.
- `drafting(block)` is `mode === "writing" && !firstDraft`. The timer's block timing (`draftingAt`, `hasDraftLeft`, `countsAsTyping`, `afterFirstReview`) is built on it. `timing(type, text)` gives `"block"` for an exercise with blocks, `"note"` for a journal, and `"none"` otherwise. The timer only reacts to typing in the note it's armed for. `renderTool` shows only in exercises.
- `journalMinutes` ("Journal goal (minutes)") is the journal's goal in `openTodaysJournal` and `startFor`.
- `became.ts` takes only the exercise's `## Work` section, so the Reflection block never goes into a story.

## Goals / Non-Goals

**Goals:**
- One parsed header (`type`, `timer`) on `WritingBlock`, and one header builder, with nothing else in the block code reshaped. The block code stays self-contained, as lint enforces.
- Timing is decided per block by its `timer` option, on top of the existing state machine. There's no second clock.

**Non-Goals:**
- Modes as a tool a type can pick. `BlockType.modes` is just empty for free-write.
- Any change to word counting. Every type is found by `findBlocks`, so `blockWords` and the word log count them as now.

## Decisions

### 1. The header is parsed into the block
`HEADER` captures the metadata: `^>\s*\[!writing(?:\|([^\]]*))?\][+-]?(?:\s+(.*?))?\s*$`. Its words, lowercased, give `type: "freewrite" | "revision"` (`revision` present) and `timer: boolean` (`timer` present). Other words are ignored. For a block whose metadata has no `revision`, `findBlocks` still runs `readFirstDraft`. If a first draft is there, the block is a revision block (spec "Reviewed blocks keep revising"). Otherwise it's free-write with `firstDraft = null`, so `mode` is `"writing"`. `findBlocks` then carries on at the block's end, or at the comment's end for a revision block, as now.

`drafting(block)` is unchanged and is true for every free-write block. A new `stillWriting(block) = block.timer && drafting(block)` is what the timer uses.

*Alternative:* treat a plain block with a first draft as free-write and leave the comment as text. Rejected with the writer: it would silently take review away from writing they've already reviewed.

### 2. Building headers
`blockHeader({ type, timer }, title?)` gives `> [!writing]`, `> [!writing|timer]`, `> [!writing|revision]` or `> [!writing|revision timer]`, with the type word before `timer`. `blockLines`, `emptyBlock`, `wrapLines`, `convertTabbed`, `newBlockAt` and `wrapBody` take an optional `kind = { type: "freewrite", timer: false }`. `putInBlock` takes one for the block it adds when the note has no empty block. When it fills a template's empty block, it keeps that header. Callers that make revision blocks pass `{ type: "revision", timer: false }`: `projects.ts` (new scene), `promote.ts` (scenes), `stories.ts` (`putInBlock` fallback) and `blockhost.ts` ("Put in a writing block").

### 3. Modes are refused at the source
`setMode` returns `{ unchanged: true }` for a free-write block, so the toolbar, the commands and `switchInFile` can't write a comment, however they're reached. `blockTypeOf` returns `FREEWRITE_BLOCK = { id: "freewrite", label: "Free-write", modes: [] }` or `REVISION_BLOCK` (today's `WRITING_BLOCK`, renamed). `renderToolbar` draws a `span.inkwell-wb-type` with the label when `modes` is empty. In `src/blockhost.ts`, the mode commands' `editorCheckCallback` and the editor menu skip blocks with no modes. "New revision block" sits beside "New writing block", reusing `newWritingBlock(editor, kind)` in `src/writingblockeditor.ts`.

### 4. Timing by the block's option
```
timing(type, text):
  blocks = findBlocks(text)
  if blocks.some(b => b.timer)  -> "block"
  if type in (exercise, journal) -> "note"
  else                           -> "none"
countsAsTyping("block", text, pos) = the block at pos is stillWriting
hasDraftLeft(text)                 = some block is stillWriting
goalFor(type, minutes, text)       = type === "exercise" && some block is (revision && stillWriting) ? minutes : 0
```
`goalFor` is used for arming on open, `startFor` (the command and "Start now"), the re-arm after the first review (`afterFirstReview` uses it in place of `s.goalMin`), and the start from typing (decision 5). That keeps the goal rule in one place. An exercise made before block types has only untimed blocks, so it's timed as a whole note, the way an exercise with no block is today.

### 5. Starting on the first keystroke in a timed block
`onType` currently ignores notes the timer isn't on. A pure `startsOnTyping(s, path, how, text, pos, autoStart)` decides whether to start a timer for this note. It returns true when auto-start is on, the note is timed by block, the keystroke is in a block that's still being written, and either there's no timer or the timer is `armed` for another note. In that last case the armed timer has no time on it, so it's replaced, as "A timer with no time on it is replaced" allows. `onType` then sets `state = typed(armed(path, goalFor(…)), now)`. A timer with time on it is never touched.

### 6. The toolbar tool in any note
`renderTool` drops the `type === "exercise"` check and shows when `stillWriting(block)`. Since only timed blocks show it, a revision block in a story draft gets no timer, as today. The "Start now" menu item uses `goalFor`.

### 7. Logging
`stop()` writes `writing_min` when the note's type is `journal` or `exercise`, or when the field is in its frontmatter (`"writing_min" in fm`, so an empty `writing_min:` counts). Otherwise it only shows "You wrote N minutes in <note>." Frontmatter stays untouched in notes that never asked to be logged.

### 8. Removing the journal goal
`journalMinutes` goes from `InkwellSettings`, `DEFAULT_SETTINGS`, the setting definitions and `getControlValue`/`setControlValue`. `mergeSettings` doesn't carry it over, and a settings test loads an old file that has it. `openTodaysJournal` arms with 0, and `startFor` uses `goalFor`, which is 0 for a journal.

### 9. Templates
- Journal: `## Writing\n- \n` (a plain list).
- Exercise: `## Work\n> [!writing|revision timer]\n> \n` and `## Reflection\n> [!writing|timer]\n> \n`.
- Story draft: `> [!writing|revision]\n> \n`.

A vault's own template files (`settings.templates.*`) are used as they are. The README says to add `revision`/`timer` to them.

### Mobile and sync
Nothing new is stored. The type and options are in the note, so they sync. The timer stays device-local (ADR 0003). The toolbar label and the timer tool are the same elements on a phone. Each device that writes in a timed block times its own writing and adds to the same `writing_min`, as today.

### Tests
- Pure (`tests/writingblocks.test.ts`): the header's type and options, the reviewed-plain-block rule, free-write always drafting, `setMode` refusing, the headers built for each kind, and the templates' blocks. In `tests/timerstate.test.ts`: `timing`, `goalFor`, `startsOnTyping`, and Work and Reflection sharing the timer. Existing timer-state tests that build exercises with `> [!writing]` blocks get `|revision timer`.
- Fake vault: `tests/timer.test.ts` (the journal arms with no goal; stopping with and without `writing_min`; re-arming after review with only free-write left), `tests/promote.test.ts` (scenes are revision blocks), `tests/became.test.ts` (the story draft holds a revision block).
- `tests/settings.test.ts`: `journalMinutes` is gone and an old settings file still loads.

## Risks / Trade-offs

- [Existing untimed plain blocks in exercises lose block timing] → They're timed as a whole note instead, so minutes are still logged. Adding `timer` to the header brings block timing back.
- [A vault's own Exercise or Story Draft template has `> [!writing]`] → New exercises and drafts made from it start with free-write blocks. The README tells the writer to update their templates, and "Write default templates" writes the new ones.
- [A timer starts in a note the writer didn't expect] → Only in a block whose header says `timer`, only with auto-start on, and only when no timer has time on it. `writing_min` isn't added to a note that doesn't have it.
- [Free-write words in a story draft count toward the piece] → A free-write block in a draft is the writer's choice, and the counting rule stays "drafts and scenes count".
