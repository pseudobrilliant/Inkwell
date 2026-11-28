# Proposal

## Why

Before Inkwell kept its own word count, each journal ended with a "Words written today" section: Keep the Rhythm's `ktr-entries` block, which listed what the writer had written that day. The writer liked it because it ties the day's writing to the day's journal note: the journal says what they thought, and the section says what they wrote. When Inkwell dropped Keep the Rhythm (ADR 0007), the section went with it, and nothing took its place. The word log already holds a row for each note on each day, so Inkwell can show the same thing from its own count.

## What Changes

- **A new `inkwell-entries` block** lists what the writer wrote on one day: each note they typed in that day, linked, with its net words, summed across devices, largest first. It ends with the day's total against the daily word goal.
- **The block knows its day.** In a journal it shows the journal's own day: its `created` date, or else a file name in the journal date format. In any other note it shows today. A `date: YYYY-MM-DD` option picks a day. So an old journal keeps showing what was written that day, and a template needs no Templater to fill in the date.
- **The built-in journal template ends with a "Words written today" section** holding the block, after the Writing section's writing block.
- **Counts like the rest of the word log:** all writing (practice, drafts and scenes) is listed. Resources and the log itself never are. A note whose words add up to zero for the day isn't listed, and a note that's since been deleted shows its name without a link.
- **Encourages, doesn't scold.** A day with nothing written says so plainly. There's no warning and no red.

Out of scope:
- **Rewriting existing notes.** Inkwell doesn't add the section to journals or journal templates the writer already has. (The writer's own Daily Journal template and three November journals will be updated by hand once this is built. That's a one-off edit to their vault, not something Inkwell does.)
- **Times of day or a per-session breakdown.** The log keeps one net number per note per day, and that's all this block shows.
- **Minutes written.** Those stay on the writing timer and `writing_min`.
- **No new weight on a lighter mode.** No new frontmatter, settings or commands. The block is opt-in in any note, and only new journals get it.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `word-log`: a new requirement for the `inkwell-entries` block: which day it shows, what it lists, and the total against the daily goal.
- `writing-blocks`: the "Drafts, scenes and journals start with a block" requirement changes, because a new journal now also ends with a "Words written today" section holding `inkwell-entries`, where it used to say that the writing block replaces that section.

## Impact

- **Constitution:** serves design principle 4 (Inkwell counts the writing itself) and principle 5 (the day's total against the daily goal). Theme 5: seeing your contribution keeps you going. Theme 4 (write, reflect, write again): the journal's reflection sits beside what was written. Tenets: plain notes (the block reads the log and writes nothing), mobile from day one (a list and a bar, with links that work on a phone), safe by default (no note is changed).
- **ADRs:** builds on ADR 0007 (Inkwell keeps its own word log) and ADR 0008 (per-device monthly notes, which readers add up). No new ADR: no choice here is hard to reverse.
- **Code:** a pure function that groups a day's log rows by note in `src/wordlog.ts`; the block in `src/wordblocks.ts`; the journal template in `src/templates.ts`; styles in `styles.css`.
- **Tests:** `tests/wordlog.test.ts`, `tests/wordblocks.test.ts`, `tests/blocks.test.ts`.
- **Docs:** README (the Words section and journal), CLAUDE.md (the Home and Practice summaries, which list the blocks).
