# Tasks

Test lines named below go in this change's `specs/word-log/spec.md` and `specs/writing-blocks/spec.md`, replacing `Test: none yet` in the same task. `npm run spec` checks them once the change is archived into `openspec/specs/`, so check names by hand before then.

## 1. ADR and pure core

- [ ] 1.1 Write ADR 0008 "The word log is per-device monthly notes" (design decision 2: options, the file format, why not `data.json`, JSON or a dot-folder), status `proposed`, and link it from the word-log spec's Purpose. Verify `npm run spec` passes.
- [ ] 1.2 Add `blockWords(text)` to `src/writingblocks.ts`: the sum of `countWords` over each block's current text. Test in `tests/writingblocks.test.ts`: two blocks, a reviewed block (its first draft isn't counted), words outside blocks aren't counted. Verify `npm test` passes.
- [ ] 1.3 New `src/wordlog.ts` with pure functions: parse and write a log file (frontmatter and table), add a delta to a day and note, rename a path or folder prefix, sum rows into days by a path match and a date range, the streak (current and longest, with today still empty counting up to yesterday, and net-negative days not counting), `weekStartFor` (moved from the KTR file, taking the `weekStart` setting), and heatmap levels from stops. Test each in `tests/wordlog.test.ts`, including a damaged row that's skipped but kept after a write. Fill in the Test lines for "The log is plain notes", "Showing up and the streak" and "The week starts on the writer's day". Verify `npm test` passes.

## 2. Storing the log

- [ ] 2.1 Add settings `folders.wordLog` (default `99 - System/Inkwell/Word log`) and `weekStart` (default Monday): `InkwellSettings`, `DEFAULT_SETTINGS`, `mergeSettings`, `getSettingDefinitions()`, `getControlValue` and `setControlValue`. Test the defaults and normalizing in `tests/settings.test.ts`. Verify `npm test` passes.
- [ ] 2.2 New `src/wordlogstore.ts`: the device id in local storage, an in-memory buffer flushed with `vault.process` at most every 10 seconds, on unload and on `visibilitychange` to hidden, and the creation of the device folder and month file. Readers parse every device's files, cached by `mtime` and cleared on `modify` in the folder. Test against the fake vault: a flush writes only this device's file, two devices' files add up, and a second flush adds to the same row. Fill in the Test lines for "Each device keeps its own log". Verify `npm test` passes.
- [ ] 2.3 Rewrite this device's paths on `vault.on("rename")`, for notes and folders. Test against the fake vault, and fill in the Test line for "Renamed and moved notes". Verify `npm test` passes.
- [ ] 2.4 Add the `WordLog` class (`weekStart`, `dailyWords`, `words`, `wordsThisWeek`, `streak`, never `null`) as `plugin.words` in `src/main.ts`, beside `plugin.ktr` for now. Verify `npm run build` passes.

## 3. Counting in the editor

- [ ] 3.1 Add a pure `countsAsWriting(userEvent)` to the block code: `input.*`, `delete.*`, `move.*`, `undo`, `redo` and `INKWELL_EDIT` count, and no event doesn't. Test it in `tests/writingblocks.test.ts`. Verify `npm test` passes.
- [ ] 3.2 Add the baseline view plugin to `writingBlockEditor` (design decision 1): open on the first counted transaction, report on 2 seconds idle, blur, close or note switch, and report then restart around an uncounted transaction. Add `onBlockWords(file, delta)` to `WritingBlockHost`, and have `src/blockhost.ts` pass it to `plugin.words`. Keep the block code free of Inkwell imports (lint enforces it). Test the baseline logic as a pure reducer over a list of transactions, covering typing, deleting, a sync change in the middle, and a mode switch. Fill in the Test lines for "What counts as words written" and "Changes Inkwell or sync makes don't count". Verify `npm run check` passes.
- [ ] 3.3 Remove the KTR "Don't count comments" notice from `src/blockhost.ts`. Verify `npm run build` passes.

## 4. Moving the numbers onto the log

- [ ] 4.1 Switch `src/contribution.ts` to `plugin.words`. Showing up comes from logged words only, and the journal and exercise fallbacks are removed. Practice words and words per mode always show. Update the doc comments. Test `practiceWeek` and `contributionFor` against the fake vault with a seeded log, and fill in the Test lines for "Words per mode and per piece". Verify `npm test` passes.
- [ ] 4.2 Switch `src/storyview.ts` and the in-progress list in `src/homeblocks.ts` to `plugin.words` for words this week. Verify `npm run build` passes, and that the story panel shows words this week in `test-vault`.
- [ ] 4.3 Draw the heatmap in Inkwell (design decision 6): `inkwell-heatmap` with `weeks`, `of` and `stops`, and the same renderer in the story and project panels, styled in `styles.css`. Test the grid's days and levels as a pure function. Fill in the Test lines for "Heatmap". Verify `npm test` passes, and check it by hand in light and dark themes and on a phone-sized window.
- [ ] 4.4 Add the `inkwell-words` block. Test its numbers as a pure function over days, and fill in the Test line for "The words block". Verify `npm test` passes.

## 5. Blocks where writing happens

- [ ] 5.1 "This became a story" puts the current text in one writing block with no first draft. Update the test "a story starts from the block's current text" in `tests/became.test.ts` and the spec scenario. Verify `npm test` passes.
- [ ] 5.2 Promote wraps each scene's body in a writing block. Update the test "scenes hold only current text, and the original draft is archived first" in `tests/promote.test.ts` (the archive still comes first). Verify `npm test` passes.
- [ ] 5.3 The built-in story draft and journal templates hold an empty block (the journal's "Words written" section and its `ktr-entries` block go), and `createScene` starts a scene's body with one unless a body is given. Test all three in `tests/blocks.test.ts`, and fill in the Test lines for "Drafts, scenes and journals start with a block". Verify `npm test` passes.
- [ ] 5.4 The story and project panels say when a draft or scene has no block, and offer "Put in a writing block" (a `vault.process` that wraps the body below the frontmatter). Test the wrap against the fake vault, and fill in the Test lines for "Writing that won't count". Verify `npm test` passes.

## 6. Removing Keep the Rhythm

- [ ] 6.1 The built-in Home template uses `inkwell-heatmap` (`of: all`, `weeks: 48`) and `inkwell-words` in place of `ktr-heatmap` and `ktr-slots`, and `src/home.ts` loses the KTR filter. Test that a new Home holds no `ktr-` blocks and that an existing Home isn't changed. Fill in the Test lines for "No Keep the Rhythm". Verify `npm test` passes.
- [ ] 6.2 Delete `src/integrations/keep-the-rhythm.ts`, `tests/keep-the-rhythm.test.ts`, `plugin.ktr`, the "Keep the Rhythm" settings section and `.claude/skills/ktr-check/`. Verify that `grep -ri "rhythm\|ktr" src tests` finds nothing, and `npm run check` passes.

## 7. Docs, ADRs, check

- [ ] 7.1 Update the README: a "Words" section (what counts, the log folder, each device's own files, the week start), the new blocks on Home, "Put in a writing block", and no more Keep the Rhythm. Verify it reads correctly.
- [ ] 7.2 Update CLAUDE.md: the progress table and the counting rule on the log, the KTR rules replaced by short word-log rules (only typing in blocks counts, each device writes only its own files, all access through `plugin.words`, pure core in `src/wordlog.ts`), `type: word-log` in the data model, the journal and movement summaries, and the Home blocks. Also remove the "Being replaced" note. In `openspec/config.yaml`, drop `ktr-integration`. Verify `grep -n "KTR\|Keep the Rhythm" CLAUDE.md` finds only history.
- [ ] 7.3 Mark ADR 0008 accepted and add it to `openspec/decisions/README.md`. Point ADR 0007's link to the block-word-log idea at the archived change. Verify `npm run spec` passes.
- [ ] 7.4 Run `npm run check` and verify it passes with zero lint errors. Run `npm run deploy:test` and walk through every scenario in both specs once in `test-vault`, on desktop and on a phone with sync between them: typing, paste, cut, undo, a mode switch, promote, a rename, and two devices on the same day.

## Workflow follow-up

- Archive the change with `npx openspec archive block-word-log` after review, then verify `npm run spec` checks the merged Test lines.
- Pick up `word-goals` next.
