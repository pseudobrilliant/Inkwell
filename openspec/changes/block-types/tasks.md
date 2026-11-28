# Tasks

## 1. Block types in the header (pure)

- [x] 1.1 In `src/writingblocks.ts`, parse the header's metadata into `WritingBlock.type` and `WritingBlock.timer`, read a plain block with a kept first draft as revision, skip the first draft for free-write, add `stillWriting`, and make `setMode` leave a free-write block unchanged (design decisions 1 and 3). Test in `tests/writingblocks.test.ts`: "the block's type and timer come from the callout's metadata", "a plain block with a kept first draft is a revision block", "a free-write block is always drafting and keeps no first draft", "switching a free-write block's mode changes nothing". Change existing tests that review a plain `> [!writing]` block with no first draft to use `> [!writing|revision]`. Set those scenarios' `Test:` lines. Verify `npm test` passes.
- [x] 1.2 Add `blockHeader(kind, title?)` and the optional `kind` on `blockLines`, `emptyBlock`, `wrapLines`, `convertTabbed`, `newBlockAt`, `wrapBody` and `putInBlock` (design decision 2). Test: "inserts an empty revision block", "wraps a selection as a revision block", and that `putInBlock` keeps a template block's header. Set their `Test:` lines. Verify `npm test` passes.

## 2. Blocks in the editor

- [x] 2.1 In `src/writingblocktoolbar.ts`, add `FREEWRITE_BLOCK`, rename `WRITING_BLOCK` to `REVISION_BLOCK`, and make `blockTypeOf` choose by type. `renderToolbar` draws the label when a type has no modes. Add `.inkwell-wb-type` to `styles.css`. Test: "a free-write block has no modes". Set its `Test:` line. Verify `npm test` passes. The toolbar's look is checked by hand in 6.3.
- [x] 2.2 In `src/blockhost.ts` and `src/writingblockeditor.ts`, add the "New revision block" command and editor-menu item, leave the mode commands and menu items out for blocks with no modes, and make "Put in a writing block" use a revision block. Verify with `npm run build`. The command, the menu and "no Review mode in a free-write block" are checked by hand in 6.3.

## 3. Revise where you revise

- [x] 3.1 Update the templates in `src/templates.ts` (design decision 9) and the revision blocks made by `src/projects.ts`, `src/promote.ts` and `src/stories.ts` (design decision 2). The writing-blocks delta modifies "Exercise template", "Drafts, scenes and journals start with a block", "Moving work up" and "Writing that won't count" to say which kind each makes. Tests: "the built-in exercise template starts Work with a timed revision block and Reflection with a timed free-write block" and "today's journal has a Writing list, no block and no ktr-entries block" in `tests/blocks.test.ts` (renamed, `Test:` lines set), the draft, scene and "Put in a writing block" checks there, "each scene's text goes in a revision block" in `tests/promote.test.ts`, the revision draft in `tests/became.test.ts`, and "templates start each block as the kind its writing needs" in `tests/writingblocks.test.ts`. Verify `npm test` passes.

## 4. Timing by the block's option

- [x] 4.1 In `src/timerstate.ts`, change `timing`, `countsAsTyping` and `hasDraftLeft` to timed blocks, add `goalFor`, and make `afterFirstReview` re-arm with it (design decision 4). Test in `tests/timerstate.test.ts`: "a note with a timed block is timed by block", "drafting and free-writing in one note share its timer", "the goal applies only while a timed revision block is being drafted". Update the existing block-timing tests to timed revision blocks, and "only exercises are timed by block" to an untimed block in a draft. Set those `Test:` lines. Verify `npm test` passes.
- [x] 4.2 Add `startsOnTyping` (design decision 5) and use it in `WritingTimer.onType`. Test: "a keystroke in a timed block starts a timer when none is in use", "a keystroke in a timed block leaves another note's timer alone". Set their `Test:` lines. Verify `npm test` passes.
- [x] 4.3 In `src/timer.ts`, show the toolbar tool on timed blocks still being written in any note, use `goalFor` in `startFor` and `armOnOpen`, allow "Start or pause writing timer" in notes with a timed block (`isTimedNote`), and log `writing_min` only to journals, exercises and notes that have the field (design decisions 6–7). Test against the fake vault in `tests/timer.test.ts`: "stopping in a note without writing_min leaves its frontmatter alone", "stopping in a note with an empty writing_min fills it in", "first review re-arms with no goal when only free-write is left". Set their `Test:` lines. Verify `npm test` passes.

## 5. No journal goal

- [x] 5.1 Remove `journalMinutes` from `src/settings.ts` and arm today's journal with no goal in `src/journal.ts` (design decision 8). Test: "an old settings file with a journal goal still loads" in `tests/settings.test.ts`, and "opening today's journal arms a timer with no goal" in `tests/timer.test.ts`. Set the latter's `Test:` line. Verify `npm test` passes.

## 6. Docs and checks

- [x] 6.1 Update the Purpose sections of `openspec/specs/writing-blocks/spec.md` (the free-write block is the default, and review belongs to revision blocks) and `openspec/specs/writing-timer/spec.md` (timed blocks in any note, no journal goal). Update the README: Writing blocks (free-write and revision, the `timer` option, "New revision block", updating your own templates), Practice (the timer, no journal goal), and the settings list. Update CLAUDE.md: the writing blocks section, the writing timer, Practice's tools, Movement (the revision blocks that are made), and the data model note on templates. Delete `openspec/ideas/writing-block-types.md` and its row in `openspec/ideas/README.md`. Verify `npm run spec` passes.
- [x] 6.2 Run `npm run check` and verify it passes with zero lint errors.
- [ ] 6.3 Run `npm run deploy:test` and check by hand on desktop and a phone:
  - a new exercise: Work's Draft, Review and Edited, Reflection's "Free-write" toolbar, one timer across both, and the first review re-arming with no goal
  - free-writing in a character note with `timer` (no frontmatter change)
  - "New writing block" and "New revision block"
  - an older reviewed `[!writing]` block still in Review
  - the journal's plain Writing list
  - the toolbar in light and dark themes

## Workflow follow-up

- Archive once built: `npx openspec archive block-types`.
- The `lessons` change also edits the exercise and journal templates. Whichever merges second combines them.
