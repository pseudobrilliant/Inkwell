# Proposal

## Why

Free-writing means writing without stopping and without fixing. It's the plainest form of practice (belief 1: *practice is the work*), and the journal's Writing section and an exercise's Reflection are where the writer does it. Today both are a full writing block, with Draft, Review and Edited modes that invite revising, or plain text with no block, which isn't counted. Neither shows how long the writer spent. The writer wants a block with no modes and a stopwatch that counts up from zero and adds the time to `writing_min`. There are no time goals for the journal: the point is to see the time spent writing. This is Inkwell's first block type (design principle 3: *block types grow with the work*), so it starts the work in the `writing-block-types` idea.

## What Changes

- **A free-write block:** `> [!writing|freewrite]`. It's the same box, with the same typing, paragraphs, word count and Typewriter Mode. It has **no modes**: it's never reviewed, no first draft is kept, and the toolbar shows "Free-write" where the modes would be. Its words count like any block's.
- **"New free-write block"**, a command and an editor-menu item, next to "New writing block".
- **The stopwatch is the writing timer, in the block's toolbar.** It starts on the first keystroke in a free-write block, pauses when the writer stops typing, picks up again when they type, and counts up from 0. It works in **any note** with a free-write block, not only exercises and journals. Stopping adds the minutes to `writing_min`: always for journals and exercises, and for any other note only if it already has a `writing_min` field.
- **Time in either block counts.** In an exercise with a Work block and a free-write Reflection block, typing in either one runs the note's one timer. The first review of the Work block still stops the timer and logs it. After that, a timer is armed with no goal while a free-write block is left.
- **Templates:** the journal's Writing section and the exercise's Reflection section become free-write blocks.
- **BREAKING: no journal time goal.** The "Journal goal (minutes)" setting is removed. The journal's timer counts up with no goal and no "Time's up" notice. Exercises keep their `minutes` goal. (Inkwell is unreleased, so there's no migration.)

Out of scope:
- **Turning the Draft / Review / Edited modes into a tool** that a type can take or leave, and the open label questions. They stay in the `writing-block-types` idea. This change adds a type with no modes, and the toolbar shows either the modes or the type's label.
- **A stopwatch that keeps running through pauses.** Free-write uses the same idle pause as today's timer.
- **Changing a block's type from the toolbar.** The writer edits the header, or makes a new block.
- **A free-write note type** or a "New free-write" command that makes a note.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `writing-blocks`: block types in the callout's metadata; the free-write block (no modes, no first draft, its toolbar label); "New free-write block"; the toolbar requirement now depends on the block's type.
- `writing-timer`: free-write blocks are timed by block in any note, the journal included; the journal has no goal; arming on the first keystroke in a free-write block; the re-arm after a first review takes no goal when only free-write is left; `writing_min` is written in other notes only when the field exists.

## Impact

- **Constitution:** serves design principles 1 (the block is the heart of writing: free-writing happens in it), 2 (the timer is a tool on the block) and 3 (the first block type, added because it's needed). Belief 1 (practice is the work) and belief 5 (minutes written are seen). Tenets: plain notes (`[!writing|freewrite]` reads as a callout without Inkwell), each mode as light as its purpose (fewer controls on practice blocks than today), mobile from day one (same toolbar and timer on a phone), safe by default (no note is rewritten; old journals keep their blocks).
- **ADRs:** ADR 0006 already leaves the callout's metadata for block types, so this follows it. ADR 0003 (timer state on the device) is unchanged. No new ADR.
- **Code:** `src/writingblocks.ts` (the type from the header, no first draft for free-write), `src/writingblocktoolbar.ts` (`blockTypeOf`, a type label in place of modes), `src/writingblockeditor.ts` and `src/writingblockview.ts` (no mode switching on free-write), `src/blockhost.ts` (commands, menu), `src/timerstate.ts` (`timing`, the re-arm goal), `src/timer.ts` (arming on typing, the toolbar tool in any note, logging), `src/journal.ts`, `src/settings.ts` (remove `journalMinutes`), `src/templates.ts`.
- **Tests:** `tests/writingblocks.test.ts`, `tests/timerstate.test.ts`, `tests/timer.test.ts`, `tests/settings.test.ts`.
- **Docs:** README (Writing blocks, Practice, the timer, settings), CLAUDE.md (writing blocks, writing timer), `openspec/ideas/writing-block-types.md` (what's done and what's left).
