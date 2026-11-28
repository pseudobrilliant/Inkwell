# Proposal

## Why

Most practice writing is free-writing: write without stopping and without fixing (belief 1: *practice is the work*). Today every writing block is a revision block, with Draft, Review and Edited modes that invite revising, even in an exercise's reflection, where nobody revises. The writer wants the plain block to be just the box, and revising to be something a block is made for: "revise where you revise". They also want each block to say whether it's timed, so time spent writing is seen wherever they want it (belief 5) and nowhere else. Design principle 3 says block types are added when they're needed. This is the first time they're needed, so this change picks up the `writing-block-types` idea (its file is deleted now that it's a change; git keeps its history).

## What Changes

- **BREAKING: the plain block is a free-write block.** `> [!writing]` is the box with typing, paragraphs, the word count and Typewriter Mode, and **no modes**: it's never reviewed and keeps no first draft. Its toolbar shows "Free-write" where the modes were.
- **The revision block is a type:** `> [!writing|revision]` is today's block, with Draft, Review and Edited, and the first draft kept in a comment.
- **A plain block you've already reviewed stays a revision block.** A `> [!writing]` header that names no type and has a kept first draft below it is read as a revision block, so no reviewed writing changes.
- **The timer is an option in the header:** `> [!writing|timer]` or `> [!writing|revision timer]`. Only blocks that say `timer` are timed. The timer works in **any note** with a timed block: it starts on the first keystroke in the block and pauses when the writer stops typing, as today. Stopping adds the minutes to `writing_min`. For journals and exercises that always happens, and for any other note only if it already has a `writing_min` field.
- **Time in any timed block counts.** In an exercise with a timed Work block and a timed Reflection block, both run the note's one timer. The exercise's `minutes` goal applies while a timed revision block is still being drafted. After that, the timer has no goal.
- **Revise where you revise.** In the templates and the notes Inkwell makes:
  - Exercise: Work is `[!writing|revision timer]` and Reflection is `[!writing|timer]`.
  - Story drafts, new scenes, and what "This became a story", "Promote" and "Put in a writing block" make: `[!writing|revision]`.
  - Journal: `## Writing` becomes a plain list (what you wrote that day), not a block.
- **"New writing block"** makes a free-write block. A new **"New revision block"** command makes the other kind. Both are in the editor menu too.
- **BREAKING: no journal time goal.** The "Journal goal (minutes)" setting is removed, so the journal's timer has no goal. Exercises keep their `minutes` goal. Inkwell is unreleased, so there's no migration.

Out of scope:
- **A toolbar control to switch a block's type or turn its timer on and off.** The writer edits the header, or makes a new block.
- **Listing the day's writing in the journal's Writing section automatically.** The section is a plain list the writer fills in.
- **A stopwatch that keeps running through pauses.** The timer pauses on idle, as today.
- **Mode labels.** Draft, Review and Edited stay as they are. The idea's question about renaming them is dropped.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `writing-blocks`: block types and the `timer` option in the header; the free-write block as the default (no modes, no first draft); older reviewed blocks read as revision blocks; review, modes and the first draft apply to revision blocks; "New revision block"; the toolbar by type.
- `writing-timer`: timing by the block's `timer` option in any note; the journal has no goal; the goal applies only while a timed revision block is being drafted; starting on the first keystroke in a timed block; `writing_min` is written in other notes only when the field exists.

## Impact

- **Constitution:** serves design principles 1 (the plain box comes first), 2 (the timer is a tool on the block, chosen per block) and 3 (the first block type, added because it's needed). Beliefs 1, 4 (revising stays one choice away) and 5 (minutes written are seen). Tenets: plain notes (types and options are callout metadata, and every block still reads as a callout), each mode as light as its purpose (practice blocks get fewer controls), mobile from day one (the same toolbar and timer on a phone), safe by default (no note is rewritten, and reviewed blocks keep revising).
- **ADRs:** ADR 0006 already leaves the callout's metadata for block types, and this change uses it for the type and the timer option. ADR 0003 (timer state on the device) is unchanged. No new ADR: the format choice is ADR 0006's, and reading a reviewed plain block as revision keeps every existing note as it was.
- **Code:** `src/writingblocks.ts` (the header's type and options, the default type, building headers), `src/writingblocktoolbar.ts` (`blockTypeOf`, the label in place of modes), `src/blockhost.ts` (commands, menu, "Put in a writing block"), `src/timerstate.ts` (timing by option, the goal), `src/timer.ts` (starting on typing, the toolbar tool in any note, logging), `src/journal.ts`, `src/settings.ts` (remove `journalMinutes`), `src/templates.ts`, `src/projects.ts`, `src/promote.ts`, `src/stories.ts`.
- **Tests:** `tests/writingblocks.test.ts`, `tests/timerstate.test.ts`, `tests/timer.test.ts`, `tests/settings.test.ts`, `tests/promote.test.ts`, `tests/became.test.ts`.
- **Docs:** README (Writing blocks, Practice, the timer, settings), CLAUDE.md (writing blocks, writing timer, movement), the writing-blocks and writing-timer specs' Purpose sections, `openspec/ideas/` (the `writing-block-types` idea is picked up).
- **Other changes:** the `lessons` change (branch `lessons`) also edits the exercise and journal templates. Whichever merges second combines them.
