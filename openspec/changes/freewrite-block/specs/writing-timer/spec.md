# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Block timing in exercises`
- TO: `### Requirement: Block timing`

## MODIFIED Requirements

### Requirement: Manual start
WHEN the writer runs "Start or pause writing timer" in an exercise, a journal, or a note with a free-write block, and no timer exists, Inkwell SHALL start a timer for that note right away, whether or not "Time practice writing" is on, with the exercise's `minutes` as the goal, or no goal for any other note.

#### Scenario: Starting by command
- **GIVEN** no timer, with an exercise open
- **WHEN** the writer runs "Start or pause writing timer"
- **THEN** a running timer is created for the exercise with its `minutes` as the goal

Test: none yet

### Requirement: Start on first keystroke
WHEN the writer types in the note an armed timer belongs to, Inkwell SHALL start the timer at that keystroke. Typing in any other note SHALL NOT affect the timer. WHILE the note is timed by block, only typing in the writing of a block still being written SHALL start it: a Draft block that was never reviewed, or a free-write block.

#### Scenario: First keystroke starts the clock
- **GIVEN** a timer armed for an exercise
- **WHEN** the writer types in it, and two minutes pass
- **THEN** the timer shows two minutes

Test: tests/timerstate.test.ts › "starts armed with no time, and the first keystroke starts it"

#### Scenario: First keystroke in the block starts the clock
- **GIVEN** a timer armed for an exercise with a writing block in Draft
- **WHEN** the writer reads the prompt, then types in the block, and two minutes pass
- **THEN** the timer shows two minutes, counted from the first keystroke in the block

Test: tests/timerstate.test.ts › "drafting in a block starts the timer"

### Requirement: Resume on typing
WHEN the writer types in the timed note while the timer is paused by idleness, Inkwell SHALL resume it. IF the writer paused the timer themselves, THEN typing SHALL NOT resume it. WHILE the note is timed by block, only typing in the writing of a block still being written (a Draft block that was never reviewed, or a free-write block) SHALL resume it.

#### Scenario: Idle pause resumes, a chosen pause does not
- **WHEN** the writer types after an idle pause
- **THEN** the timer runs again
- **WHEN** the writer types after pausing the timer from its menu or command
- **THEN** the timer stays paused

Test: tests/timerstate.test.ts › "typing resumes an idle pause but not a pause you chose"

#### Scenario: Time across pauses adds up
- **GIVEN** a timer that ran 2 minutes, was paused, then resumed
- **WHEN** it runs 3 more minutes
- **THEN** it shows 5 minutes

Test: tests/timerstate.test.ts › "adds up separate running stretches"

#### Scenario: Reflecting after an idle pause doesn't resume
- **GIVEN** a timer for an exercise with a block, paused by idleness, whose reflection is plain text outside any block (as in exercises made before free-write blocks)
- **WHEN** the writer types in the reflection
- **THEN** the timer stays paused

Test: tests/timerstate.test.ts › "typing outside a Draft block is not drafting" [the pure check; resuming itself is covered by "typing resumes an idle pause but not a pause you chose"]

### Requirement: Logging minutes
WHEN the writer stops the timer, Inkwell SHALL add the time, rounded to whole minutes, to the timed note's `writing_min` frontmatter field, adding to any value already there. For a note that isn't a journal or an exercise, Inkwell SHALL write `writing_min` only IF the note already has that field, and otherwise SHALL only say how long the writer wrote. IF the rounded time is under one minute, THEN Inkwell SHALL log nothing and say so.

#### Scenario: Rounded minutes are added
- **GIVEN** a note with `writing_min: 10` and a timer showing 2 minutes 36 seconds
- **WHEN** the writer stops the timer
- **THEN** the note has `writing_min: 13` and a notice says 3 minutes were logged

Test: tests/timerstate.test.ts › "logs whole minutes, rounded" (rounding only; adding to the note: none yet)

#### Scenario: Under a minute
- **GIVEN** a timer showing 20 seconds
- **WHEN** the writer stops it
- **THEN** the note is unchanged and a notice says nothing was logged

Test: tests/timerstate.test.ts › "logs whole minutes, rounded" (rounding only)

#### Scenario: A note without writing_min
- **GIVEN** a story's notes page with a free-write block and no `writing_min` field, and its timer showing 6 minutes
- **WHEN** the writer stops the timer
- **THEN** the note's frontmatter is unchanged, and a notice says 6 minutes were written

Test: tests/timer.test.ts › "stopping in a note without writing_min leaves its frontmatter alone"

#### Scenario: A note with an empty writing_min
- **GIVEN** a note with a free-write block and `writing_min:` with no value, and its timer showing 4 minutes
- **WHEN** the writer stops the timer
- **THEN** the note has `writing_min: 4`

Test: tests/timer.test.ts › "stopping in a note with an empty writing_min fills it in"

### Requirement: Block timing
WHILE the timed note is an exercise (`type: exercise`) with at least one writing block, or any note with a free-write block, Inkwell SHALL time it by block: only keystrokes in the writing of a free-write block, or of a block in Draft mode that has no kept first draft, SHALL count as typing for the timer. Journals and exercises with no such block SHALL be timed as a whole note, and other notes SHALL NOT be timed.

#### Scenario: Typing outside the block doesn't start the timer
- **GIVEN** a timer armed for an exercise with a writing block in Draft mode
- **WHEN** the writer types in the exercise's prompt or notes, outside the block
- **THEN** the timer stays armed with no time

Test: tests/timerstate.test.ts › "typing outside a Draft block is not drafting"

#### Scenario: Typing in a reviewed block doesn't count
- **GIVEN** a running timer for an exercise with one block in Review and one in Draft
- **WHEN** the writer types only in the block in Review until the idle time passes
- **THEN** the timer pauses by idleness, counting only up to the last keystroke in the Draft block

Test: tests/timerstate.test.ts › "typing in a reviewed block is not drafting"

#### Scenario: Two Draft blocks share the note's timer
- **GIVEN** an exercise with two blocks in Draft, and a timer armed for it
- **WHEN** the writer types two minutes in the first block, then three in the second
- **THEN** the one timer shows five minutes, and both blocks' toolbars show it

Test: tests/timerstate.test.ts › "drafting in either of two blocks counts" [both toolbars showing it: checked by hand]

#### Scenario: A journal is still timed as a whole note
- **GIVEN** a timer armed for today's journal, which has no writing block
- **WHEN** the writer types anywhere in it
- **THEN** the timer starts

Test: tests/timerstate.test.ts › "a journal or an exercise without a block is timed as a whole note"

#### Scenario: A block in a draft gets no timer
- **GIVEN** a story draft (`type: draft`) with a writing block and no free-write block
- **WHEN** the writer types in the block
- **THEN** no timer is armed or started, and the block's toolbar shows no timer

Test: tests/timerstate.test.ts › "only exercises are timed by block"

#### Scenario: Work and reflection share the timer
- **GIVEN** an exercise with a Work block in Draft and a free-write block in Reflection, and a timer armed for it
- **WHEN** the writer types five minutes in Work, then three in Reflection
- **THEN** the one timer shows eight minutes, and both blocks' toolbars show it

Test: tests/timerstate.test.ts › "drafting and free-writing in one note share its timer"

#### Scenario: A journal with a free-write block
- **GIVEN** a timer armed for today's journal, whose Writing section is a free-write block
- **WHEN** the writer types in Daily Goals, then in the free-write block
- **THEN** the timer starts only at the first keystroke in the free-write block

Test: tests/timerstate.test.ts › "a note with a free-write block is timed by block"

### Requirement: Reviewing ends the draft's timing
WHEN a block in the timed exercise enters Review for the first time (its first draft is kept), Inkwell SHALL stop the timer and log its minutes to the exercise's `writing_min`, as stopping does. IF another block in the exercise is then still in Draft with no kept first draft, THEN Inkwell SHALL arm a new timer for the exercise with the same goal. IF only free-write blocks are left, THEN Inkwell SHALL arm a new timer with no goal.

#### Scenario: First review logs the minutes
- **GIVEN** an exercise with `writing_min: 5`, one block in Draft, and its timer showing 12 minutes 10 seconds
- **WHEN** the writer picks Review on the block's toolbar
- **THEN** the exercise has `writing_min: 17`, a notice says 12 minutes were logged, and no timer remains

Test: tests/timer.test.ts › "first review stops the timer and logs its minutes"

#### Scenario: Another block still in Draft
- **GIVEN** an exercise with two blocks in Draft, a 10-minute goal, and a running timer
- **WHEN** the writer reviews the first block
- **THEN** the minutes are logged, and a timer is armed for the exercise with a 10-minute goal, showing "Ready · 10 min"

Test: tests/timer.test.ts › "first review re-arms when another block is still in draft"

#### Scenario: Later mode switches don't touch the timer
- **GIVEN** a block that was already reviewed, and a timer armed for the exercise because another block is in Draft
- **WHEN** the writer switches the reviewed block between Review, Edited and Draft
- **THEN** the timer is unchanged

Test: tests/timer.test.ts › "switching a reviewed block's mode leaves the timer alone"

#### Scenario: Review in a note the timer isn't on
- **GIVEN** a running timer for exercise A
- **WHEN** the writer reviews a block in exercise B
- **THEN** the timer for exercise A is unchanged

Test: tests/timer.test.ts › "reviewing in another note leaves the timer alone"

#### Scenario: Only the reflection is left
- **GIVEN** an exercise with a 10-minute goal, a Work block in Draft, a free-write Reflection block, and a running timer
- **WHEN** the writer reviews the Work block
- **THEN** the minutes are logged, and a timer is armed for the exercise with no goal, showing "Ready"

Test: tests/timer.test.ts › "first review re-arms with no goal when only free-write is left"

### Requirement: Timer in the block's toolbar
WHILE the timed note is timed by block, Inkwell SHALL show the timer in the toolbar of each of its blocks still being written (free-write blocks, and blocks in Draft mode with no kept first draft), as the elapsed time and, with a goal, a ring that fills toward it, full at the goal and after. A tap on it SHALL open the timer's menu. WHILE an exercise with a block, or a note with a free-write block, has no timer, those blocks' toolbars SHALL offer to start one.

#### Scenario: The timer in the block's toolbar
- **GIVEN** a running timer with a 10-minute goal for an exercise with a block in Draft
- **WHEN** the timer shows 2 minutes 30 seconds
- **THEN** the block's toolbar shows `2:30` and a ring a quarter full, the note has no timer header button, and on desktop the status bar shows the timer too

Test: tests/timerstate.test.ts › "goal progress is the share of the goal written" [the ring's share; the toolbar and header button checked by hand]

#### Scenario: No goal, no ring
- **GIVEN** a running timer with no goal for an exercise with a block in Draft
- **WHEN** the writer looks at the block's toolbar
- **THEN** it shows the elapsed time with no ring

Test: tests/timerstate.test.ts › "goal progress is the share of the goal written" [no goal gives no progress]

#### Scenario: Past the goal
- **GIVEN** a running timer with a 10-minute goal
- **WHEN** it reaches 14 minutes
- **THEN** the ring stays full and the time keeps counting

Test: tests/timerstate.test.ts › "goal progress is the share of the goal written" [capped at full]

#### Scenario: Reviewed blocks show no timer
- **GIVEN** an exercise with one block in Review and one in Draft, and a timer for it
- **WHEN** the writer looks at both toolbars
- **THEN** only the Draft block's toolbar shows the timer

Test: none yet [checked by hand in test-vault]

#### Scenario: Starting from the toolbar
- **GIVEN** no timer, with "Time practice writing" off, and an exercise with a block in Draft
- **WHEN** the writer taps the timer in the block's toolbar and picks "Start now"
- **THEN** a running timer is created for the exercise with its `minutes` as the goal

Test: none yet [checked by hand in test-vault]

#### Scenario: Another note's timer
- **GIVEN** a running timer for exercise A
- **WHEN** the writer opens exercise B, which has a block in Draft
- **THEN** B's block toolbar shows no timer, and the status bar still shows A's

Test: none yet [checked by hand in test-vault]

## REMOVED Requirements

### Requirement: Arming
**Reason**: The journal no longer has a time goal ("Journal goal (minutes)" is removed), so arming is restated without it, and the goal rule for free-write is added.
**Migration**: See "Arming a timer" and "No goal for free-writing". Inkwell is unreleased, so the setting is dropped with no migration.

## ADDED Requirements

### Requirement: Arming a timer
WHERE "Time practice writing" is on, WHEN the writer creates an exercise, opens an exercise, or opens today's journal, Inkwell SHALL arm the timer for that note: with the exercise's `minutes` as its goal, or no goal for a journal. A goal of 0 means no goal, and a negative goal SHALL be treated as 0. IF the exercise has writing blocks and every one of them has a kept first draft, THEN Inkwell SHALL NOT arm a timer for it on opening, because nothing is left to draft.

#### Scenario: Opening today's journal arms it with no goal
- **GIVEN** no timer
- **WHEN** the writer opens today's journal
- **THEN** a timer is armed for the journal with no goal, showing "Ready"

Test: tests/timer.test.ts › "opening today's journal arms a timer with no goal"

#### Scenario: Negative goal
- **WHEN** a timer is armed with a goal of -5 minutes
- **THEN** its goal is 0

Test: tests/timerstate.test.ts › "never takes a negative goal"

#### Scenario: Auto-start off
- **GIVEN** "Time practice writing" is off
- **WHEN** the writer creates an exercise
- **THEN** no timer is armed

Test: none yet

#### Scenario: An exercise with nothing left to draft
- **GIVEN** no timer, and an exercise whose only writing block is in Edited mode
- **WHEN** the writer opens it
- **THEN** no timer is armed

Test: tests/timerstate.test.ts › "an exercise whose blocks are all reviewed has nothing to draft"

### Requirement: No goal for free-writing
IF only free-write blocks are left to write in, in an exercise whose Draft blocks have all been reviewed, THEN a timer armed for it SHALL have no goal.

#### Scenario: An exercise with only its reflection left
- **GIVEN** no timer, and an exercise with a 10-minute goal whose Work block is reviewed and whose Reflection is a free-write block
- **WHEN** the writer opens it
- **THEN** a timer is armed for it with no goal, showing "Ready"

Test: tests/timerstate.test.ts › "the goal applies only while a Draft block is left"


### Requirement: Starting in a free-write block
WHERE "Time practice writing" is on, WHEN the writer types in a free-write block and no timer has time on it, Inkwell SHALL start a timer for that note at that keystroke, with the exercise's `minutes` as the goal if a Draft block is left in it, or no goal otherwise. A timer for another note that has time on it SHALL be left alone, and the keystroke SHALL NOT start one.

#### Scenario: Free-writing in any note
- **GIVEN** no timer, and a character note with a free-write block
- **WHEN** the writer types in the block
- **THEN** a running timer for the character note starts at that keystroke, and the block's toolbar shows it

Test: tests/timerstate.test.ts › "a keystroke in a free-write block starts a timer when none is in use"

#### Scenario: Another note's timer in use
- **GIVEN** a running timer for exercise A
- **WHEN** the writer types in a free-write block in today's journal
- **THEN** the timer for exercise A is unchanged, and no timer starts for the journal

Test: tests/timerstate.test.ts › "a keystroke in a free-write block leaves another note's timer alone"
