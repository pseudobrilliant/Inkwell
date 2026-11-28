# Design

## Context

See proposal.md for why, and the two spec deltas for the behaviour. Relevant state today:

- `HEADER` in `src/writingblocks.ts` already accepts metadata (`[!writing|…]`) and drops it. `WritingBlock` has no type.
- `src/writingblocktoolbar.ts` already has `BlockType { id, modes }`, `WRITING_BLOCK`, and `blockTypeOf(block)`, which always returns `WRITING_BLOCK`. `renderToolbar` draws `blockTypeOf(block).modes`, then the host's tools.
- `drafting(block)` is `mode === "writing" && !firstDraft`, and the timer's block timing (`draftingAt`, `hasDraftLeft`, `countsAsTyping`) is built on it.
- `timing(type, text)` in `src/timerstate.ts`: an exercise with blocks is timed by `"block"`, a journal by `"note"`, everything else `"none"`. The timer only reacts to typing in the note it's armed for (`onType` returns early otherwise). `renderTool` shows only in exercises.
- `journalMinutes` (setting "Journal goal (minutes)") is the journal's goal in `openTodaysJournal` and `startFor`.
- `became.ts` takes only the exercise's `## Work` section, so a free-write Reflection never goes into a story. `promote.ts` unwraps every block to its text, which works the same for free-write.

## Goals / Non-Goals

**Goals:**
- One new field (`WritingBlock.type`) and one new type, without reshaping the mode code. The block code stays self-contained (lint enforces its imports).
- Free-write reuses the writing timer and its state machine. There's no second clock.

**Non-Goals:**
- Modes as a tool (the `writing-block-types` idea). `BlockType.modes` is just empty for free-write.
- Any change to how words are counted. Free-write blocks are found by `findBlocks` like any block, so `blockWords` and the word log count them already.

## Decisions

### 1. The type is parsed into the block
`HEADER` captures the metadata: `^>\s*\[!writing(?:\|([^\]]*))?\][+-]?(?:\s+(.*?))?\s*$`. `WritingBlock` gets `type: BlockTypeId` (`"writing" | "freewrite"`). Metadata that's missing or unknown gives `"writing"` (spec "Block type"). For a free-write block, `findBlocks` skips `readFirstDraft`, so `firstDraft` is null and `mode` is `"writing"`, and the scan carries on at the block's end. A comment below it is then just text after the block (spec "No review for a free-write block").

This makes `drafting(freewrite)` true always, which is exactly what the timer needs: typing in a free-write block counts, and `hasDraftLeft` is true while one is in the note.

### 2. Modes are refused at the source
`setMode` returns `{ unchanged: true }` for a free-write block, so the toolbar, the commands and `switchInFile` can't write a comment, however they're reached. `blockTypeOf` returns `FREEWRITE_BLOCK = { id: "freewrite", label: "Free-write", modes: [] }`. `renderToolbar` draws a `span.inkwell-wb-type` with the label when `modes` is empty. The mode commands' `editorCheckCallback` and the editor menu skip blocks with no modes.

### 3. "New free-write block" reuses `newBlockAt`
`newBlockAt(lines, selection, type?)` passes the type through to `emptyBlock(type)`, `wrapLines(…, type)` and `convertTabbed`, which build the header with `blockHeader(type)` (`> [!writing|freewrite]`). `newWritingBlock(editor, type?)` in `src/writingblockeditor.ts` is reused.

### 4. Timing: free-write makes a note timed by block
```
timing(type, text):
  blocks = findBlocks(text)
  if blocks.some(b => b.type === "freewrite") -> "block"
  if type === "exercise" -> blocks.length ? "block" : "note"
  if type === "journal"  -> "note"
  else -> "none"
```
`countsAsTyping` is unchanged, since free-write blocks are drafting. A pure `goalFor(type, minutes, text)` gives the exercise's `minutes` when a Draft block with no first draft is left (`b.type === "writing" && drafting(b)`), and 0 otherwise. Arming on open, `startFor`, re-arming after the first review (`afterFirstReview` uses it in place of `s.goalMin`) and the free-write start all use it, so the goal rule is in one place.

### 5. Starting on the first keystroke in a free-write block (pure decision)
`onType` currently ignores notes the timer isn't on. A pure `startsOnFreewrite(s, path, how, text, pos, autoStart)` decides whether to start a timer for this note. It returns true when auto-start is on, the note is timed by block, the keystroke is in a free-write block, and either there's no timer or the timer is `armed` with no time. In the last case it's for another note, and it's replaced, as "A timer with no time on it is replaced" already allows. `onType` then sets `state = typed(armed(path, goalFor(…)), now)`. A timer with time on it is never touched.

### 6. The toolbar tool in any note
`renderTool` drops the `type === "exercise"` check and shows when `drafting(block)` and the note is timed by block. `drafting` covers free-write, and `timingOf` gives `"block"` for any note with a free-write block. A plain writing block in a story draft is still `"none"`, so it still gets no timer. The "Start now" menu item uses `goalFor`.

### 7. Logging
`stop()` writes `writing_min` when the note's type is `journal` or `exercise`, or when the field is present in its frontmatter (`"writing_min" in fm`, so an empty `writing_min:` counts). Otherwise it only shows "You wrote N minutes in <note>." This keeps frontmatter untouched in notes that never asked to be timed, such as a character note.

### 8. Removing the journal goal
`journalMinutes` goes from `InkwellSettings`, `DEFAULT_SETTINGS`, the setting definitions and `getControlValue`/`setControlValue`. `mergeSettings` drops it, because it spreads only known keys or ignores the extra one; the settings test covers an old file that has it. `openTodaysJournal` arms with 0. Inkwell is unreleased, so there's no migration.

### 9. Templates
- Journal: `## Writing\n> [!writing|freewrite]\n> \n`.
- Exercise: `## Reflection\n> [!writing|freewrite]\n> \n`. Work stays a writing block. A blank line separates the two blocks' sections already, since each is under its own heading.

### Mobile and sync
Nothing new is stored. The type is in the note, so it syncs. The timer stays device-local (ADR 0003). The toolbar label and timer tool are the same elements on a phone. Each device that free-writes times its own writing and adds to the same `writing_min`, as today.

### Tests
- Pure: `tests/writingblocks.test.ts` (the type, no first draft, `setMode` refusing, the new block's header, wrapping) and `tests/timerstate.test.ts` (`timing`, `goalFor`, `startsOnFreewrite`, shared timing).
- Fake vault (`tests/timer.test.ts`): opening the journal arms with no goal, stopping in a note with or without `writing_min`, and re-arming after review with only free-write left.
- `tests/settings.test.ts`: `journalMinutes` is gone and an old settings file still loads.

## Risks / Trade-offs

- [Starting a timer in any note surprises a writer who free-writes in a story's notes] → It only starts in a free-write block, only when auto-start is on, and only when no timer has time on it. `writing_min` isn't written to a note that doesn't have it.
- [An armed timer for the journal is replaced when the writer free-writes elsewhere first] → That's today's rule for a timer with no time on it. Once the writer types, the timer belongs to that note until stopped.
- [Free-write words in a story draft count toward the piece] → A free-write block in a draft is the writer's choice. The counting rule stays "drafts and scenes count", as for any block there.
- [A type that isn't known yet (`[!writing|sonnet]`) is shown as a writing block] → It still reads as a callout. When that type is added, it starts working with no change to notes.
