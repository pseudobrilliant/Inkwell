# 0008. The word log is per-device monthly notes

- **Status:** accepted
- **Date:** 2026-11-26
- **Specs:** word-log

## Context

[ADR 0007](0007-inkwell-keeps-its-own-word-log.md) decided that Inkwell keeps its own word log: the net words typed in writing blocks, per note per day. The log is the writer's data. Once written, its format is hard to change, and it has to sync between a phone and a desktop through whatever sync the writer uses (Obsidian Sync, iCloud, Syncthing, git). Those syncs work on whole files. When two devices change the same file, the result is a conflict copy, or one device's version wins. Either way a day can be lost, and that's how Keep the Rhythm's numbers go wrong.

## Decision drivers

- Two devices must never overwrite each other's words.
- Plain notes, always: the writer can read the log in Obsidian, or in any editor, without Inkwell.
- Mobile from day one: the Vault API only, never `vault.adapter`.
- Writes are small and frequent, so each write should rewrite little.

## Considered options

1. **The plugin's `data.json`.** Easy, but the settings file syncs whole, so two devices overwrite each other's days. That's Keep the Rhythm's problem again.
2. **One JSON file per device in the vault.** Each device writes only its own file, so sync can't overwrite. Easy to parse, but not a note the writer can read in Obsidian, and `.json` files sit oddly in a vault.
3. **A hidden `.inkwell/` folder.** Out of sight, but the Vault API doesn't see dot-folders, and `vault.adapter` is off-limits.
4. **One Markdown note per device.** Readable, and safe from overwrites, but it grows without end, and every write rewrites the whole history.
5. **One Markdown note per device per month.** Readable, safe from overwrites, and each write rewrites only this month.

## Decision

We chose **option 5**. Each device writes `<folders.wordLog>/<device>/<YYYY-MM>.md`, and only that device ever writes in its folder. Readers add up every device's files.

- **Device id:** made once on each device from its kind and four random hex digits (`desktop-3f9a`, `mobile-07c1`), and kept in the device's local storage (`app.saveLocalStorage`), as ADR 0003 does for the timer. It is never in the synced settings.
- **The file:** frontmatter `type: word-log`, `device` and `month`, then one Markdown table with one row per day and note:

  ```markdown
  ---
  type: word-log
  device: desktop-3f9a
  month: 2026-11
  ---
  | Date | Note | Words |
  | --- | --- | --- |
  | 2026-11-26 | 02 - Stories/The Chapel/The Chapel - Draft.md | 25 |
  ```

  The note is a plain vault path, not a link. Obsidian rewrites links in every note when a file is renamed, which would make one device write into another device's files. A `|` in a path is written `\|`. Words are the net change for that day, so they can be negative.
- **Writes:** buffered in memory and added in with `vault.process` at most every 10 seconds, and when Inkwell unloads or the app goes to the background. A write adds to the row for that day and note, or appends one, and keeps every line it can't read exactly as it was.
- **The default folder** is `99 - System/Inkwell/Word log`, beside the templates, and can be changed in settings.

## Consequences

- Good: sync can't lose a day, because no file is ever written by two devices.
- Good: the log is a readable note. Uninstalling Inkwell loses nothing.
- Good: a write rewrites one small file, and a year is twelve files per device.
- Bad: renames are seen only by the device that makes them, which rewrites its own files. Another device's rows keep the old path, so that piece's words this week can be low until the week ends. Totals, the streak and the heatmap are unaffected.
- Bad: the vault gets a log folder the writer didn't make. It sits under `99 - System`.
- Bad: up to 10 seconds of words can be lost if the app is killed before a flush.
- Follow-up: minutes from the writing timer can be added later as another column, with readers treating a missing column as zero.
