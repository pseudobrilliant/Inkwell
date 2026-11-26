# Design

## Context

All KTR access already sits behind one class, `KeepTheRhythm` in `src/integrations/keep-the-rhythm.ts`, reached as `plugin.ktr`. Its callers are `src/contribution.ts` (`weekStart`, `dailyWords`, `words`, `streak`), `src/homeblocks.ts` (`wordsThisWeek`, `heatmapBlock`), `src/storyview.ts` (`wordsThisWeek`, `heatmapBlock`), `src/home.ts` (a KTR filter for the Home template), `src/blockhost.ts` (`ignoresComments`) and `src/settings.ts` (`status`). Every method returns `null` when KTR is missing, and the callers hide the number.

The writing block code (`src/writingblock*.ts`) imports only Obsidian, CodeMirror and itself, and talks to Inkwell through `WritingBlockHost`: `tools` (toolbar tools, so far the writing timer), `onFirstDraftSaved({ sourcePath, text })` (which stops the timer and shows the KTR notice) and `onWritingInBlock`. The editor finds a block's note with `sourcePathOf(state)`, from `editorInfoField`. `countWords` (`src/wordcount.ts`) already skips the header line and comments, so it counts a block's current text only.

What gets built is in proposal.md and the specs (`word-log`, `writing-blocks`). This file covers how.

## Goals / Non-Goals

**Goals:**
- One interface, `plugin.words`, that replaces `plugin.ktr` method for method (`weekStart`, `dailyWords`, `words`, `wordsThisWeek`, `streak`), so callers change little and never get `null`.
- Counting that can tell the writer's own edits from Inkwell's and from sync, without the block code knowing about the log.
- A log that two devices can never overwrite, readable as plain notes, using the Vault API only.

**Non-Goals:**
- Exact counts while two devices edit the same note at the same moment (see Risks).
- A history view or charts beyond the heatmap and `inkwell-words`.

## Decisions

### 1. Count at the editor, from the writer's own transactions

A CodeMirror view plugin in the block editor watches transactions. A transaction counts when it carries a writer's user event: `input.*`, `delete.*`, `move.*`, `undo`, `redo`, or Inkwell's own key edits (`INKWELL_EDIT`, which is Enter, Shift+Enter and Backspace inside a block). A transaction without a user event (a file reloaded after sync or another app, `vault.process`, Inkwell's own rewrites) doesn't.

Counting every keystroke would be wasteful, so the plugin keeps a **baseline**: on the first counted transaction it records the block words of the state before it, and after 2 seconds idle, on blur, or when the editor closes or switches note, it reports `words now − baseline` and clears the baseline. If an uncounted transaction arrives while a baseline is open, the plugin first reports up to the state before it, then starts again after it, so a sync change never lands in a delta.

The block code reports through a new host method, `onBlockWords(sourcePath, delta)`, finding the note with the existing `sourcePathOf(state)`; an editor with no file reports nothing. A word count shown in the toolbar would be a `BlockTool` later, and isn't part of this change. The count is a new pure `blockWords(text)` (the sum of `countWords` over each block's current text). It lives in `src/writingblockwords.ts` with `countsAsWriting`, the baseline tally and `countWords` itself, which moved there from `src/wordcount.ts` (now a re-export), so the block code counts without importing the rest of Inkwell, as lint requires.

- *Alternative: diff the file on `vault.on("modify")`.* It can't tell the writer's edit from sync or from Inkwell's own writes, which is the main way KTR goes wrong.
- *Alternative: count only notes Inkwell created.* Too narrow: blocks work in any note.

### 2. Per-device monthly notes in the vault (new ADR 0008)

Each device writes `<folders.wordLog>/<device>/<YYYY-MM>.md`: frontmatter `type: word-log`, `device`, `month`, then a Markdown table `| Date | Note | Words |` with one row per day and note. The device id is made once (`desktop-3f9a`, from `Platform.isMobile` and 4 random hex digits) and kept in `app.saveLocalStorage`, per ADR 0003. Deltas are buffered in memory and written with `vault.process` at most every 10 seconds, and on unload. A write adds to the row for that day and note, or appends one, and keeps rows it can't parse.

Readers list the folder, parse every month file of every device, and cache each one by its `mtime`. A `modify` event in the folder clears the cache. A year is 12 small files per device.

- *Alternative: one JSON file per device.* Easy to parse, but not a note the writer can read in Obsidian, and `.json` files sit oddly in a vault.
- *Alternative: the plugin's `data.json`.* It syncs whole, so two devices would overwrite each other's days, which is KTR's problem again.
- *Alternative: a hidden `.inkwell/` folder.* The Vault API doesn't see dot-folders, and `vault.adapter` is off-limits.
- *Alternative: one file per device, not per month.* It grows without end, and each write rewrites the whole history.

Because this is the writer's data and is hard to change once written, it gets an ADR: **0008, the word log is per-device monthly notes**.

### 3. Pure core in `src/wordlog.ts`

Parsing and writing a log file, adding a delta to a file, renaming paths in a file, summing rows into days (`dailyWordsIn(rows, match, from, to)`), the streak (`streakIn(days, today)`: current and longest), the week start (`weekStartFor(today, weekStart)`, moved from the KTR file), and heatmap levels are all pure functions. `src/wordlogstore.ts` is the thin part that talks to the vault and holds the buffer and the cache, and `WordLog` is the class behind `plugin.words`.

### 4. What the numbers match on

`modeMatchers` (`src/contribution.ts`) stays the single definition of practice, stories, projects and all. `all` also leaves out the word log folder. A piece's words this week match its draft path or its `Scenes/` prefix, as they do today.

### 5. Renames

On `vault.on("rename")`, this device rewrites the old path (or folder prefix) to the new one in its own files, current month and earlier. It never touches another device's files (see Risks).

### 6. Heatmap and `inkwell-words` are drawn by Inkwell

Both are built with `createEl` and styled in `styles.css` with Obsidian CSS variables. The heatmap is a grid of weeks by days with five levels. The default stops are 1, 100, 500 and 1,000 words, changeable with a `stops` option. Each square has an `aria-label` with the date and words. The same renderer serves `inkwell-heatmap` and the story and project panels.

### 7. Moving up keeps blocks

`workSection` (`src/became.ts`) keeps `unwrapBlocks` and then wraps the result in a block (`blockLines`), so the story's draft is one block of current text with no first draft. `promote.ts` unwraps, splits as now, and wraps each scene's body in a block. Both write through `vault.create`, so nothing is logged. "Put in a writing block" rewrites the note with `vault.process`, so it isn't logged either.

### 8. Settings

- `folders.wordLog`: default `99 - System/Inkwell/Word log`.
- `weekStart`: a dropdown of weekdays, default Monday.

Both are added through `getSettingDefinitions()`, `getControlValue` and `setControlValue`, and `mergeSettings` gives defaults. The "Keep the Rhythm" settings section is removed.

## Risks / Trade-offs

- [Two devices edit the same note while offline, then sync] → Each device logs only its own typing, so both count, which is right. But when sync merges the note, neither device logs the merge. That's also right, since nobody typed it.
- [A rename on one device isn't seen on another] → The other device's rows keep the old path. Totals, the streak and the heatmap are unaffected. Only that piece's words this week can be low, until the week ends. Accepted.
- [Undo after a long pause counts as negative words] → That matches what the writer did (net words). Accepted.
- [The editor watch misses an edit path, such as a plugin that edits without a user event] → It undercounts, never overcounts. The by-hand checks in the tasks cover typing, paste, cut, undo and mobile input.
- [Buffered words are lost if the app is killed] → At most 10 seconds of counts. They're also flushed on unload and on `visibilitychange` to hidden, which covers mobile apps going to the background.
- [The log folder clutters the vault] → It sits under `99 - System`, beside the templates, and the folder can be changed in settings.

## Migration Plan

None. Nothing has been released, so there's no upgrade path. The log starts empty. In the test and writing vaults, delete the Home note to get the new one, and use "Put in a writing block" on drafts that predate blocks.

## Open Questions

- Default heatmap stops for a phone's narrow screen: 24 weeks may need to drop to 12 on mobile. This can be decided by hand during the mobile check.
