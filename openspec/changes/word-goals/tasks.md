# Tasks

## 1. The goals in settings

- [x] 1.1 Add `dailyWordGoal` (default 300) and `weeklyWordGoal` (default 1500) to `InkwellSettings` and `DEFAULT_SETTINGS`. Normalize them in `mergeSettings` (a whole number of 0 or more, otherwise the default), and add "Daily word goal" and "Weekly word goal" number controls to the Words group, handled in `controlValue`/`applyControlValue`. Test in `tests/settings.test.ts` ("a goal that isn't a number falls back to the default"; "each goal is set on its own") and set the "A goal that isn't a number" scenario's `Test:` line. Verify `npm test` passes.

## 2. Goal progress (pure)

- [x] 2.1 Add `goalProgress(days, today, weekStart, goals)` to `src/wordlog.ts` (design decision 2): for each goal that's on, the words, the goal, the share reached capped at 1, and whether it's met; and the goal days this week when the daily goal is on. Add `plugin.words.goals()` to read it from the log. Test in `tests/contribution.test.ts` ("practice and pieces both count toward the day's goal", through the log) and `tests/wordlog.test.ts`: "a goal of 0 is off", "missing a day can still make the week", "a day under the goal isn't a goal day but keeps the streak". Set the `Test:` lines of "Practice counts toward the day's goal", "Missing a day, making the week" and "Under the goal keeps the streak". Verify `npm test` passes.
- [x] 2.2 Add the pure `goalReached(before, after, goal)` and the once-a-day, once-a-week check against the saved `{ day, week }` (design decision 4). Test in `tests/wordlog.test.ts`: "a goal is reached only when the words cross it", "a goal notice shows once a day and once a week". Verify `npm test` passes.

## 3. Goals on Home

- [x] 3.1 In `src/wordblocks.ts`, show today's and this week's words against their goals in the `inkwell-words` block, each as "N of G" with a progress bar (a `<progress>`, like the story panel's) and a met mark, what it shows kept in a pure `wordStats`, plus the goal days this week; show nothing for a goal that's off. Add the styles to `styles.css` with Obsidian CSS variables. Test in `tests/wordblocks.test.ts`: "the words block shows today and this week against the goals", "a met goal shows a full bar marked met", "only a weekly goal shows only the week's bar". Set the `Test:` lines of "Only a weekly goal", "Partway to the goals", "Past the goal" and "Two devices toward one goal" (from a log with two devices' notes, in `tests/wordlogstore.test.ts`). Verify `npm test` passes.
- [x] 3.2 In `src/contribution.ts`, add `goal` to each of `PracticeWeek.days` and mark goal days in the `inkwell-practice` strip with `is-goal` and a "goal met" label (design decision 3), with no mark for a missed goal. Test in `tests/contribution.test.ts`: "the practice strip marks goal days apart from days that showed up", "a day under the goal has no missed mark". Set the `Test:` lines of "Goal days in the practice strip" and "A quiet day". Verify `npm test` passes.

## 4. The goal notice

- [x] 4.1 In `WordLog.add` (`src/wordlogstore.ts`), after logging words for a note that counts toward all writing, check the daily and weekly goals for a crossing and show "Daily word goal reached: N words today." or "Weekly word goal reached: N words this week.", keeping the last notices in local storage (`inkwell-goal-notices`). Keep `add` synchronous for its callers and log the check's errors. Test against the fake vault in `tests/wordlogstore.test.ts`: "typing past the daily goal shows a notice", "cutting and typing again shows no second notice", "a goal reached on another device shows no notice here", "typing past the weekly goal shows a notice". Set the `Test:` lines of the three scenarios under "A notice when a goal is reached". Verify `npm test` passes.

## 5. Docs and checks

- [x] 5.1 Update the README: goals in the Words section and in the settings list, how to turn a goal off, and that practice counts toward the goals but never toward a piece. Update CLAUDE.md: the progress table's session/day and lifetime rows, the Home summary, and the note at the top of the progress model. Add `word-goals` to the capability list in `openspec/config.yaml`. Verify `npm run spec` passes.
- [x] 5.2 Check that every scenario in the change's spec names a test (no `Test: none yet` left). Run `npm run check` and verify it passes with zero lint errors.
- [ ] 5.3 Run `npm run deploy:test` and check by hand, on desktop and on a phone: the words block's bars in light and dark themes and on a narrow screen, the goal days in the practice strip, the notice when a goal is crossed, no notice after sync brings in the other device's words, and turning each goal off in the settings.

## Workflow follow-up

- Archive once built: `npx openspec archive word-goals`.
