# Proposal

## Why

The [constitution](../../constitution.md) makes daily and weekly word goals core (design principle 5) and puts them on Home, where progress is seen (principle 6). The block-word-log change gave Inkwell its own word count, the same on every device. Goals are the step that change was laying the ground for. Today Inkwell has time goals for exercises and journals and word targets for pieces, but nothing that says whether today's or this week's writing is enough. This change picks up the word-goals idea (its file is deleted now that it's a change; git keeps its history).

## What Changes

- **Two goals, each set on its own:** "Daily word goal" and "Weekly word goal", in the Words settings group. Either can be off (0). The weekly goal isn't worked out from the daily one, so a writer who writes in long weekend sessions can set a weekly goal alone.
- **All writing counts toward the goals.** Practice (journals and exercises), story drafts and scenes all count, the same as the streak. Notes in Resources and the word log don't. Practice still never counts toward a piece's progress.
- **Goals in the `inkwell-words` block:** today's words against the daily goal and this week's against the weekly goal, each with a progress bar, and a mark when a goal is met.
- **Goal days are their own number.** A day whose words reach the daily goal is a goal day. The words block shows the goal days this week, and the `inkwell-practice` week strip marks them. The streak stays "days you wrote something": a day under the goal still keeps the streak. A missed day doesn't stop the weekly goal either, which counts the week's words however they were spread.
- **A notice when a goal is reached**, once a day for the daily goal and once a week for the weekly goal, on the device where the writer's typing crossed it.
- **Goals encourage, they don't scold.** A missed goal shows nothing: no red, no warning, no count of misses.

Out of scope:
- **A goal tool on the block's toolbar** (today's words against the goal while writing). It fits design principle 2, but it can follow once the goals have settled.
- **Goals per mode or per piece.** Pieces already have `target_wordcount`. Goals are for the writing life as a whole.
- **Goal history:** goal weeks in a row, a goal streak, goal days on the heatmap.
- **Minutes goals.** Exercise and journal time goals stay as they are, on the writing timer.
- **No new weight on a lighter mode.** No goal fields in any note's frontmatter, and nothing new to fill in when making an exercise, story or project.

## Capabilities

### New Capabilities
- `word-goals`: the daily and weekly word goals: the settings, what counts toward them, how progress and goal days show in the words and practice blocks, and the notice when one is reached.

### Modified Capabilities
None. The `word-log` capability's requirements stay as the block-word-log change writes them. Goals are shown in its blocks through requirements of their own in `word-goals`, so this change doesn't depend on the order the two are archived in.

## Impact

- **Constitution:** serves design principles 5 (goals for the day and week) and 6 (Home is where progress is seen). Theme 5: seeing your contribution keeps you going. Tenets: plain notes (goals live in settings, nothing is added to notes), mobile from day one (the blocks and the notice work on a phone), safe by default (nothing is written to notes at all).
- **ADRs:** builds on ADR 0007 and ADR 0008 (the count). ADR 0003 (device-local state) applies to remembering which goal notices this device has shown. No new ADR: no choice here is hard to reverse.
- **Depends on:** the block-word-log change (PR #6). This change is branched from it.
- **Code:** a pure goal-progress function beside `wordsSummary` in `src/wordlog.ts`; goals in `src/settings.ts`; the words block in `src/wordblocks.ts`; the practice block in `src/contribution.ts`; the goal notice after `plugin.words.add` in `src/wordlogstore.ts`; styles in `styles.css`.
- **Tests:** `tests/wordlog.test.ts`, `tests/wordblocks.test.ts`, `tests/contribution.test.ts`, `tests/wordlogstore.test.ts`, `tests/settings.test.ts`.
- **Docs:** README (Words section, settings), CLAUDE.md (the progress table and Home summary), `openspec/config.yaml` (capability list), the ideas README.
