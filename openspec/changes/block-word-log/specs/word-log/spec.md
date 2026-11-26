# Spec Delta

## Purpose

Inkwell keeps its own log of the words a writer types in writing blocks, on every device, and builds every word number it shows on that log: words per day, week and mode, a piece's words this week, the streak, the heatmap and the `inkwell-words` block. Decisions behind this spec: [ADR 0007](../../decisions/0007-inkwell-keeps-its-own-word-log.md), [ADR 0006](../../decisions/0006-writing-block-first-draft-in-a-comment.md), [ADR 0003](../../decisions/0003-timer-state-in-device-local-storage.md).

## ADDED Requirements

### Requirement: What counts as words written
WHEN the writer edits a note in the editor, Inkwell SHALL log the net change in the words of the note's writing blocks, counted as in the writing-blocks "Word counts" requirement, for that note on that day. Words outside writing blocks, and a block's first draft, SHALL NOT count.

#### Scenario: Typing in a block
- **GIVEN** a note whose writing blocks hold 100 words
- **WHEN** the writer types 25 words in a block
- **THEN** today's log for that note goes up by 25

Test: none yet

#### Scenario: Deleting in a block
- **GIVEN** a note whose writing blocks hold 100 words
- **WHEN** the writer deletes 40 words from a block and types 10
- **THEN** today's log for that note goes down by 30

Test: none yet

#### Scenario: Typing outside a block
- **GIVEN** a note with a writing block
- **WHEN** the writer types 50 words in the note's Reflection section, below the block
- **THEN** the log doesn't change

Test: none yet

#### Scenario: Entering review
- **GIVEN** a block with 200 words that has never been reviewed
- **WHEN** the writer switches it to Review, which saves its first draft
- **THEN** the log doesn't change

Test: none yet

### Requirement: Changes Inkwell or sync makes don't count
Inkwell SHALL log only edits the writer makes in the editor. Notes Inkwell creates or rewrites itself (a new exercise, "This became a story", "Promote story to long form", a revision snapshot) and changes that arrive by sync or from another app SHALL NOT be logged.

#### Scenario: A story becomes a project
- **GIVEN** a story draft with 3,000 words in writing blocks
- **WHEN** the writer promotes it to long form
- **THEN** the log doesn't change, though the scenes now hold 3,000 words in blocks

Test: none yet

#### Scenario: A change arrives by sync
- **GIVEN** a note open on the desktop
- **WHEN** sync brings in 300 words typed in its block on the phone
- **THEN** the desktop logs nothing for it, and the phone's own log has the 300 words

Test: none yet

### Requirement: Each device keeps its own log
Inkwell SHALL keep each device's log in files that only that device writes, in the word log folder (setting `folders.wordLog`, default `99 - System/Inkwell/Word log`), one subfolder per device and one file per month. WHEN Inkwell adds up words, it SHALL read every device's files, so a day written on two devices counts both.

#### Scenario: Two devices on the same day
- **GIVEN** 200 words typed on the desktop and 150 on the phone, both today, and both devices synced
- **WHEN** either device shows today's words
- **THEN** it shows 350

Test: none yet

#### Scenario: A device writes only its own files
- **GIVEN** log files from the desktop and the phone in the word log folder
- **WHEN** the writer types on the phone
- **THEN** only the phone's files change

Test: none yet

### Requirement: The log is plain notes
Each log file SHALL be a Markdown note with frontmatter `type: word-log`, `device` and `month` (`YYYY-MM`), and a table with one row per day and note: the date (`YYYY-MM-DD`), the note's path, and the net words. Rows Inkwell can't read SHALL be skipped and kept as they are, not removed.

#### Scenario: Reading a log file without Inkwell
- **GIVEN** a device that logged 25 words in "02 - Stories/The Chapel/The Chapel - Draft.md" on 2026-11-26
- **WHEN** the writer opens that month's log file in any Markdown editor
- **THEN** it shows a row with `2026-11-26`, that path, and `25`

Test: none yet

#### Scenario: A damaged row
- **GIVEN** a log file with a row whose words aren't a number
- **WHEN** Inkwell adds up the month
- **THEN** that row is skipped and the other rows count
- **AND** the row is still in the file after the next write

Test: none yet

### Requirement: Renamed and moved notes
WHEN a note with logged words is renamed or moved, Inkwell SHALL update the note's path in this device's log files.

#### Scenario: Renaming a story draft
- **GIVEN** 500 words logged this week for "The Chapel - Draft.md"
- **WHEN** the writer renames the story to "The Lock"
- **THEN** the story's words this week are still 500

Test: none yet

### Requirement: The week starts on the writer's day
Inkwell SHALL start each week on the day set in the setting "Week starts on" (`weekStart`, Monday by default) for every weekly number it shows.

#### Scenario: A Sunday week
- **GIVEN** "Week starts on" set to Sunday, and today is Wednesday 2026-11-25
- **WHEN** Inkwell shows words this week
- **THEN** it counts from Sunday 2026-11-22

Test: none yet

### Requirement: Words per mode and per piece
Inkwell SHALL add up logged words by where the note is: practice (journals and exercise writing), stories (story drafts, not archived snapshots), projects (scenes), and all writing (everything except Resources). A piece's words this week SHALL count only its draft or its scenes. Practice words SHALL NOT count toward a piece.

#### Scenario: A story's words this week
- **GIVEN** 400 words logged this week in a story's draft and 300 in an exercise
- **WHEN** the story panel shows the story
- **THEN** it shows 400 words this week

Test: none yet

#### Scenario: Your contribution by mode
- **GIVEN** this month's log has 1,000 practice words, 2,000 draft words and 500 scene words
- **WHEN** `inkwell-contribution` shows this month
- **THEN** it shows 1,000 practice words, 2,000 draft words, 500 scene words and 3,500 words in all

Test: none yet

### Requirement: Showing up and the streak
A day SHALL count as showed up WHEN the writer's logged words for that day, across all writing, add up to more than zero. The streak SHALL be the number of showed-up days in a row up to today, or up to yesterday while today has no words yet. Inkwell SHALL also keep the longest streak.

#### Scenario: An exercise without writing
- **GIVEN** an exercise made today, with no words typed in its block
- **WHEN** "Practice this week" shows today
- **THEN** today isn't marked as showed up

Test: none yet

#### Scenario: The streak before writing today
- **GIVEN** words logged on each of the last 5 days, and none yet today
- **WHEN** Inkwell shows the streak
- **THEN** it shows 5 days

Test: none yet

#### Scenario: A day of cutting
- **GIVEN** a day where the writer deleted more words than they typed
- **WHEN** Inkwell works out the streak
- **THEN** that day doesn't count as showed up

Test: none yet

### Requirement: Heatmap
The `inkwell-heatmap` block SHALL show one square per day for the last N weeks (option `weeks`, default 24), shaded by that day's logged words, with the words and date on hover or tap. Option `of` SHALL choose what counts: `pieces` (drafts and scenes, the default), `practice`, `stories`, `projects`, or `all`. The story and project panels SHALL show the same heatmap for their draft or scenes.

#### Scenario: Home's heatmap
- **GIVEN** an `inkwell-heatmap` block with `of: all` and `weeks: 48`
- **WHEN** the note renders
- **THEN** it shows 48 weeks of days, shaded by all the writer's words

Test: none yet

#### Scenario: A day with no words
- **GIVEN** a day with nothing logged
- **WHEN** the heatmap shows it
- **THEN** its square is empty, and hovering it shows the date and 0 words

Test: none yet

### Requirement: The words block
The `inkwell-words` block SHALL show the writer's words today, this week, and this month with the month's daily average, and the current and longest streak, all from the log across all writing.

#### Scenario: Words on Home
- **GIVEN** 300 words today, 1,200 this week and 4,500 this month by the 15th, and a 6-day streak
- **WHEN** the `inkwell-words` block renders
- **THEN** it shows 300 today, 1,200 this week, 4,500 this month at 300 a day, and a 6-day streak

Test: none yet

### Requirement: No Keep the Rhythm
Inkwell SHALL NOT read Keep the Rhythm's data or settings, or embed its blocks. Its built-in Home and journal templates SHALL use Inkwell's own blocks instead. Notes the writer already has SHALL NOT be changed.

#### Scenario: A new Home
- **GIVEN** no Home note and no custom Home template
- **WHEN** the writer opens Home
- **THEN** it's created with `inkwell-heatmap` and `inkwell-words` blocks and no `ktr-` blocks

Test: none yet

#### Scenario: An existing Home
- **GIVEN** a Home note that holds `ktr-heatmap` and `ktr-slots` blocks
- **WHEN** the writer opens Home
- **THEN** the note is unchanged

Test: none yet
