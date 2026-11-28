## ADDED Requirements

### Requirement: The entries block
The `inkwell-entries` block SHALL list each note whose logged words for its day, summed across every device's log, are not zero: the note linked, with its net words, largest first. It SHALL end with the day's total of all writing against the daily word goal (`dailyWordGoal`), counted as the word goals count it. Resources and the word log itself SHALL NOT be listed.

#### Scenario: A journal's day
- **GIVEN** a journal `2026-11-22.md` with `created: 2026-11-22`, and a log with 450 words in `Tide - Draft.md` and 120 in that journal on 2026-11-22, and 300 in `Tide - Draft.md` on 2026-11-23
- **WHEN** its `inkwell-entries` block renders on 2026-11-27
- **THEN** it lists `Tide - Draft` with 450 words, then the journal with 120 words, and a total of 570

Test: tests/wordlog.test.ts › "a day's entries list each note's words, largest first, with the total"

#### Scenario: Words from two devices
- **GIVEN** 200 words in `Tide - Draft.md` on 2026-11-22 in the phone's log and 150 in the laptop's
- **WHEN** the block shows 2026-11-22
- **THEN** it lists `Tide - Draft` once, with 350 words

Test: tests/wordlog.test.ts › "a note written on two devices is listed once with both devices' words"

#### Scenario: Notes that aren't listed
- **GIVEN** on one day a resource note with 80 logged words, and a draft whose words were +40 and then −40
- **WHEN** the block shows that day
- **THEN** neither is listed

Test: tests/wordlog.test.ts › "a day's entries leave out resources, the log, and notes that add up to zero"

#### Scenario: A note that was deleted
- **GIVEN** a logged note that no longer exists
- **WHEN** the block lists it
- **THEN** it shows the note's name without a link, with its words

Test: tests/wordblocks.test.ts › "an entry for a deleted note shows its name without a link"

#### Scenario: The day's goal
- **GIVEN** a daily goal of 300 and 570 words on the day
- **WHEN** the block renders
- **THEN** its total shows 570 of 300 with the goal marked met
- **AND** with the daily goal off, it shows the total alone

Test: tests/wordblocks.test.ts › "the entries block shows the day's total against the daily goal, or alone when it's off"

#### Scenario: A day with nothing written
- **GIVEN** a day with nothing logged
- **WHEN** the block shows it
- **THEN** it says nothing was written in writing blocks that day, with no warning

Test: tests/wordblocks.test.ts › "a day with nothing written says so plainly"

### Requirement: The entries block's day
The `inkwell-entries` block SHALL show the day in its `date` option (`YYYY-MM-DD`). WHERE there's no `date` option, in a note with `type: journal` Inkwell SHALL show the journal's `created` date, or else its file name read in the journal date format; in any other note, today.

#### Scenario: Which day the block shows
- **GIVEN** a journal with no `created` date whose file name is `2026-11-21.md`, a story draft, and a block with `date: 2026-11-20`
- **WHEN** each renders an `inkwell-entries` block on 2026-11-27
- **THEN** the journal's block shows 2026-11-21, the draft's shows 2026-11-27, and the block with the option shows 2026-11-20

Test: tests/wordblocks.test.ts › "the entries block shows the date option, else a journal's day, else today"
