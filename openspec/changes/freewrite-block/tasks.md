# Tasks

## 1. The free-write block (pure)

- [ ] 1.1 In `src/writingblocks.ts`, capture the header's metadata into `WritingBlock.type` (`"writing" | "freewrite"`, unknown → writing), skip the first draft for free-write, and make `setMode` leave a free-write block unchanged (design decisions 1–2). Test in `tests/writingblocks.test.ts`: "the block's type comes from the callout's metadata", "a free-write block is always drafting and keeps no first draft", "switching a free-write block's mode changes nothing", "a first-draft comment after a free-write block is ignored". Set those scenarios' `Test:` lines. Verify `npm test` passes, the existing block tests included.
- [ ] 1.2 Add the type to `emptyBlock`, `wrapLines`, `convertTabbed` and `newBlockAt` through a `blockHeader(type)` (design decision 3). Test: "inserts an empty free-write block", "wraps a selection as a free-write block". Set their `Test:` lines. Verify `npm test` passes.

## 2. The free-write block in the editor

- [ ] 2.1 In `src/writingblocktoolbar.ts`, add `FREEWRITE_BLOCK` and make `blockTypeOf` return it for free-write blocks. `renderToolbar` draws the type's label when it has no modes. Add `.inkwell-wb-type` to `styles.css`. Test: "a free-write block has no modes" (`blockTypeOf` and its modes). Set the `Test:` line. Verify `npm test` passes, and check the toolbar by hand in Live Preview and reading view.
- [ ] 2.2 In `src/blockhost.ts` and `src/writingblockeditor.ts`, add the "New free-write block" command and editor-menu item, and leave the mode commands and menu items out for blocks with no modes. Verify by hand in test-vault: the command, the menu, and no "Review mode" in a free-write block.

## 3. Timing free-writing

- [ ] 3.1 In `src/timerstate.ts`, change `timing` for free-write blocks and add `goalFor`. Make `afterFirstReview` re-arm with `goalFor` (design decision 4). Test in `tests/timerstate.test.ts`: "a note with a free-write block is timed by block", "drafting and free-writing in one note share its timer", "the goal applies only while a Draft block is left". Set those `Test:` lines, and add "and no free-write block" to the existing "A block in a draft gets no timer" test's setup. Verify `npm test` passes.
- [ ] 3.2 Add `startsOnFreewrite` (design decision 5) and use it in `WritingTimer.onType`. Test: "a keystroke in a free-write block starts a timer when none is in use", "a keystroke in a free-write block leaves another note's timer alone". Set their `Test:` lines. Verify `npm test` passes.
- [ ] 3.3 In `src/timer.ts`, show the toolbar tool in any note timed by block, make `startFor` and `armOnOpen` use `goalFor`, and log `writing_min` only to journals, exercises and notes that have the field (design decisions 6–7). Allow "Start or pause writing timer" in notes with a free-write block (`isTimedNote`). Test against the fake vault in `tests/timer.test.ts`: "stopping in a note without writing_min leaves its frontmatter alone", "stopping in a note with an empty writing_min fills it in", "first review re-arms with no goal when only free-write is left". Set their `Test:` lines. Verify `npm test` passes.

## 4. No journal goal

- [ ] 4.1 Remove `journalMinutes` from `src/settings.ts` (the type, the defaults, the definition, the control value), and arm today's journal with no goal in `src/journal.ts` (design decision 8). Test: "an old settings file with a journal goal still loads" in `tests/settings.test.ts`, and "opening today's journal arms a timer with no goal" in `tests/timer.test.ts`. Set the latter's `Test:` line. Verify `npm test` passes.

## 5. Templates

- [ ] 5.1 In `src/templates.ts`, make the journal's Writing section and the exercise's Reflection section free-write blocks (design decision 9). Test: "the journal and exercise templates have free-write blocks where the writer free-writes", in `tests/writingblocks.test.ts` (find the blocks in the rendered templates and check their types). Verify `npm test` passes.

## 6. Docs and checks

- [ ] 6.1 Update the writing-timer spec's Purpose (`openspec/specs/writing-timer/spec.md`) to say free-write blocks are timed in any note and the journal has no goal. Update the README (Writing blocks: the free-write block and its command; Practice: the timer, no journal goal; the settings list) and CLAUDE.md (the writing-blocks section, the writing timer, Practice's tools). Update `openspec/ideas/writing-block-types.md` with what this change did (the type in the metadata, the free-write type, a label in place of modes) and what's left (modes as a tool, labels, tool order). Verify `npm run spec` passes.
- [ ] 6.2 Run `npm run check` and verify it passes with zero lint errors.
- [ ] 6.3 Run `npm run deploy:test` and check by hand on desktop and a phone: today's journal free-write with the stopwatch counting up and logging to `writing_min`, an exercise with Work and Reflection sharing one timer, the first review re-arming with no goal, free-writing in a character note (stopwatch, no frontmatter change), and the toolbar in light and dark themes.

## Workflow follow-up

- Archive once built: `npx openspec archive freewrite-block`.
- The `lessons` change also edits the exercise and journal templates (a Lessons section). Whichever merges second rebases them together.
