# Spec Delta

## Purpose

A daily and a weekly word goal show the writer whether they're keeping up the practice, on Home and in the blocks that show their words. Goals are counted from Inkwell's word log, across all writing and every device, and they encourage rather than scold. Decisions behind this spec: [ADR 0007](../../decisions/0007-inkwell-keeps-its-own-word-log.md), [ADR 0008](../../decisions/0008-word-log-is-per-device-monthly-notes.md), [ADR 0003](../../decisions/0003-timer-state-in-device-local-storage.md).

## ADDED Requirements

### Requirement: Daily and weekly goals
Inkwell SHALL offer two settings in the Words group: "Daily word goal" (`dailyWordGoal`, default 300) and "Weekly word goal" (`weeklyWordGoal`, default 1,500). Each SHALL be set on its own: changing one SHALL NOT change the other. WHERE a goal is 0, Inkwell SHALL treat that goal as off and show nothing for it. A value that isn't a whole number of 0 or more SHALL fall back to the default.

#### Scenario: Only a weekly goal
- **GIVEN** "Daily word goal" set to 0 and "Weekly word goal" set to 2,000
- **WHEN** the `inkwell-words` block renders
- **THEN** it shows this week's words against 2,000
- **AND** today's words show without a goal

Test: none yet

#### Scenario: A goal that isn't a number
- **GIVEN** "Daily word goal" set to "lots"
- **WHEN** Inkwell loads its settings
- **THEN** the daily goal is 300

Test: none yet

### Requirement: What counts toward a goal
Inkwell SHALL count toward both goals the net words logged across all writing: journals, exercises, story drafts and scenes, on every device. Notes in Resources and in the word log folder SHALL NOT count. The daily goal SHALL count today's words. The weekly goal SHALL count the words from the first day of the week (setting "Week starts on") to today.

#### Scenario: Practice counts toward the day's goal
- **GIVEN** a daily goal of 300, 200 words typed in an exercise today and 150 in a story draft
- **WHEN** Inkwell shows today's goal
- **THEN** it shows 350 of 300 and the goal as met

Test: none yet

#### Scenario: Two devices toward one goal
- **GIVEN** a daily goal of 300, 200 words typed on the desktop today and 150 on the phone, both synced
- **WHEN** either device shows today's goal
- **THEN** it shows 350 of 300

Test: none yet

### Requirement: Goals in the words block
WHERE a goal is on, the `inkwell-words` block SHALL show, under Today, today's words against the daily goal, and under This week, the week's words against the weekly goal, each as "N of G" with a progress bar that fills up to the goal. WHEN a goal is met, its bar SHALL show as full and marked met. The block SHALL also show the goal days so far this week WHERE the daily goal is on.

#### Scenario: Partway to the goals
- **GIVEN** a daily goal of 300 and a weekly goal of 1,500, 120 words today and 900 this week, with 2 goal days this week
- **WHEN** the `inkwell-words` block renders
- **THEN** Today shows "120 of 300" with its bar 40% full
- **AND** This week shows "900 of 1,500" with its bar 60% full
- **AND** it shows 2 goal days this week

Test: none yet

#### Scenario: Past the goal
- **GIVEN** a daily goal of 300 and 450 words today
- **WHEN** the `inkwell-words` block renders
- **THEN** Today shows "450 of 300" with a full bar marked met

Test: none yet

### Requirement: Goal days
A day SHALL be a goal day WHEN its net words across all writing reach the daily goal. Goal days SHALL NOT change the streak or showing up: a day with words below the goal SHALL still count as showed up. WHERE the daily goal is on, the `inkwell-practice` week strip SHALL mark each goal day apart from days that only showed up. The weekly goal SHALL be met WHEN the week's words reach it, whatever the number of goal days.

#### Scenario: Missing a day, making the week
- **GIVEN** a daily goal of 300 and a weekly goal of 1,500
- **AND** this week the writer wrote 600, 0, 500 and 450 words
- **WHEN** Inkwell shows this week
- **THEN** it shows 3 goal days and the weekly goal as met at 1,550 of 1,500

Test: none yet

#### Scenario: Under the goal keeps the streak
- **GIVEN** a daily goal of 300, and 100 words on each of the last 4 days
- **WHEN** Inkwell shows the streak and the goal days
- **THEN** the streak is 4 days, and none of the 4 days is a goal day

Test: none yet

#### Scenario: Goal days in the practice strip
- **GIVEN** a daily goal of 300, 350 words on Monday and 50 on Tuesday
- **WHEN** `inkwell-practice` shows this week
- **THEN** Monday is marked as a goal day and Tuesday as showed up

Test: none yet

### Requirement: A notice when a goal is reached
WHEN words the writer types in a writing block take today's words from below the daily goal to the goal or over it, Inkwell SHALL show the notice "Daily word goal reached: N words today." on that device. WHEN they take this week's words to the weekly goal or over it, Inkwell SHALL show "Weekly word goal reached: N words this week." Each notice SHALL show at most once a day (daily) or once a week (weekly) on each device. Words arriving by sync from another device SHALL NOT show a notice.

#### Scenario: Reaching the daily goal
- **GIVEN** a daily goal of 300 and 280 words today
- **WHEN** the writer types 30 more words in a block
- **THEN** the notice "Daily word goal reached: 310 words today." shows

Test: none yet

#### Scenario: Cutting and writing again
- **GIVEN** the daily goal was reached today and its notice shown
- **WHEN** the writer cuts 50 words, going under the goal, and types them again
- **THEN** no second notice shows

Test: none yet

#### Scenario: The goal was reached on another device
- **GIVEN** a daily goal of 300, and 320 words typed on the phone today and synced to the desktop
- **WHEN** the writer types 10 words on the desktop
- **THEN** the desktop shows no notice

Test: none yet

### Requirement: Goals don't scold
IF a goal isn't met, THEN Inkwell SHALL show only the words so far against the goal: no warning colour, no message, and no count of missed days or weeks. Past days that weren't goal days SHALL look the same as they do with no goal set.

#### Scenario: A quiet day
- **GIVEN** a daily goal of 300, and yesterday had 40 words
- **WHEN** `inkwell-practice` shows this week
- **THEN** yesterday is marked as showed up, with no mark for a missed goal

Test: none yet
