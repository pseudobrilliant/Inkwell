# Tasks

## 1. A day's entries (pure)

- [x] 1.1 Add `dayEntries(rows, day, match)` to `src/wordlog.ts` (design decision 1): the day's rows that match, summed by path across devices, zero sums dropped, largest first and then by path, plus the total. Add `WordLog.dayEntries(day)` in `src/wordlogstore.ts` with `modeMatchers(plugin).all`. Test in `tests/wordlog.test.ts`: "a day's entries list each note's words, largest first, with the total", "a note written on two devices is listed once with both devices' words", "a day's entries leave out resources, the log, and notes that add up to zero". Set the `Test:` lines of "A journal's day", "Words from two devices" and "Notes that aren't listed". Verify `npm test` passes.

## 2. The entries block

- [x] 2.1 Add the pure `entriesDay(option, note, today, journalFormat)` to `src/wordblocks.ts` (design decision 2): a valid `date:` option, else for `type: journal` its `created` date, else its file name in the journal date format, else today. An invalid option counts as none. Test in `tests/wordblocks.test.ts`: "the entries block shows the date option, else a journal's day, else today", and set the "Which day the block shows" scenario's `Test:` line. Verify `npm test` passes.
- [x] 2.2 Add the pure `entriesView(entries, exists, goals)` and `renderEntries` (design decision 3): names, words, internal links for notes that exist and plain text for deleted ones, and the total with the daily goal's bar through the words block's `goalOf`. A day with nothing written says "Nothing written in writing blocks on this day." Register `inkwell-entries` as a `LiveBlock` in `registerWordBlocks`, reading its note from `ctx.sourcePath`. Add the styles to `styles.css` with Obsidian CSS variables. Test in `tests/wordblocks.test.ts`: "an entry for a deleted note shows its name without a link", "the entries block shows the day's total against the daily goal, or alone when it's off", "a day with nothing written says so plainly". Set the `Test:` lines of "A note that was deleted", "The day's goal" and "A day with nothing written". Verify `npm test` passes.

## 3. The journal template

- [x] 3.1 End the built-in journal template in `src/templates.ts` with `## Words written today` and an empty `inkwell-entries` block, after the Writing section (design decision 4). In `tests/blocks.test.ts`, "today's journal holds an empty writing block and no ktr-entries block" also checks that the section and block come after the writing block. It keeps its name, so the main spec's `Test:` line still finds it before the change is archived. Verify `npm test` passes.

## 4. Docs and checks

- [x] 4.1 Update the README: the `inkwell-entries` block and its `date` option in the Words section, and the journal's "Words written today" section. Update CLAUDE.md: add `inkwell-entries` to the Home blocks list and the Practice tools, and the journal's section to the Practice structure. No new ADR. Verify `npm run spec` passes.
- [x] 4.2 Check that every scenario in the change's specs names a test (no `Test: none yet` left). Run `npm run check` and verify it passes with zero lint errors.
- [ ] 4.3 Run `npm run deploy:test` and check by hand, on desktop and on a phone: an old journal's block shows its own day, today's journal updates as the writer types (after the flush), links open the note and hover previews it, a deleted note shows as plain text, and the bar in light and dark themes.

## Workflow follow-up

- Archive once built: `npx openspec archive day-entries`.
- In the writer's vault (by hand, not by Inkwell): add the "Words written today" section with `inkwell-entries` back to `99 - System/Templates/Daily Journal.md` and the journals of 2026-11-21, 22 and 23.
