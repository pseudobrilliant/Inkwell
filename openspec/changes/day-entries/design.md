# Design

## Context

The word log already holds what this block needs. Every device writes rows of date, note path and net words to its own monthly notes (ADR 0008). `WordLogStore.rows()` returns every device's rows plus this device's unflushed buffer. `dailyWordsIn` sums those rows per day for a path filter, but it drops the note path, and the block needs it. `inkwell-words` and `inkwell-heatmap` (`src/wordblocks.ts`) show the pattern: a `LiveBlock` that redraws when a note in Inkwell's folders changes (the word log folder is one of them), with what the block shows kept in a pure function (`wordStats`) so it can be tested without a DOM.

## Goals / Non-Goals

**Goals:**
- One pure function from log rows to a day's entries, and one from a note to the block's day, both tested without a DOM.
- Reuse the goal bar from the words block, so a day's total looks the same in both blocks.

**Non-Goals:**
- No new event or refresh path. The block redraws when the log notes change, like the words block does.
- No change to the log's format or to how words are counted.

## Decisions

1. **A pure `dayEntries(rows, day, match)` in `src/wordlog.ts`** returns `{ entries: { path, words }[], total }`. It keeps the rows for that day that `match` allows, sums them by path (which adds up the devices), drops paths that come to zero, and sorts the rest by words, largest first, then by path. The total is the sum of the rows, so it equals that day's figure in `allDays()`. `WordLog.dayEntries(day)` calls it with `modeMatchers(plugin).all`, so resources and the log stay out, as everywhere else.
   - *Alternative:* extend `dailyWordsIn` to keep paths. Rejected because it's the hot path for the heatmap and the streak, and they don't need paths.

2. **The day comes from a pure `entriesDay(option, note, today, journalFormat)` in `src/wordblocks.ts`.** A valid `date:` option wins. Next, for `type: journal`, comes `created` (read through `fmStr`, strictly `YYYY-MM-DD`), then the file's base name parsed strictly in `journalDateFormat`. Otherwise it's today. An option that isn't a valid date is treated as no option, so a typo shows something sensible and never an error. The block reads its note from `ctx.sourcePath` through `getFileByPath` and `fmOf`.
   - *Alternative:* the date in the block's body, as `ktr-entries` did, filled in by Templater. Rejected because the core daily notes plugin doesn't run Templater, and it repeats a date the journal already holds.

3. **What the block shows is a pure `entriesView(entries, goals)`**, like `wordStats`: each entry's name (the base name), words and path, then the total with a goal from `goalOf`, the words block's helper. `renderEntries` only draws it. A note that still exists is drawn as an Obsidian internal link (`a.internal-link` with `data-href`, opened with `workspace.openLinkText(path, sourcePath)`), so hovering previews it and Ctrl/⌘-click opens a new tab. A deleted note is drawn as plain text.

4. **Template:** the built-in journal template takes the writer's own sections: `## Daily Goals`, `## Ideas, Observations, Reflections`, `## Journal Notes` holding the writing block, an empty `## Writing`, and `## Words Written today` with an empty `inkwell-entries` block. `ensureTodaysJournal` already writes `created`, so a new journal's block shows its own day from the start.

## Mobile and sync

- **Mobile:** a short list of links and one bar, the same parts the words block uses. Tapping a link opens the note. There's nothing to hover.
- **Sync:** each device's rows are read from its own log notes and added up, so a note written on the phone and on the laptop is listed once with both devices' words (ADR 0008). Rows from another device show up once sync brings its log note and the block redraws. This device's unflushed words are included through the store's buffer, and they show at the next redraw.

## Tests

- **Pure:** `dayEntries` (grouping, devices, zero sums, resources and log left out, order, total) in `tests/wordlog.test.ts`. `entriesDay` and `entriesView` (option, `created`, file name, today, deleted note, goal on and off, empty day) in `tests/wordblocks.test.ts`.
- **Fake vault:** today's journal from the built-in template holds the writing block, under "Journal Notes", then "Writing", then the "Words Written today" section with the block (`tests/blocks.test.ts`).

## Risks / Trade-offs

- [A journal's metadata isn't cached yet at first render, so the block shows today] → the block is a `LiveBlock`, which redraws when the journal's metadata arrives (`metadataCache` "changed"). A journal named in the date format gets its day from the file name even without metadata.
- [Words typed on this device show up to 10 seconds late, until the buffer flushes and the log note changes] → the words block has the same delay. Not worth a new event for.
- [A day's list can get long on a big day] → there's at most one row per note per day, so it's bounded by how many notes were written in that day. No limit is set.
