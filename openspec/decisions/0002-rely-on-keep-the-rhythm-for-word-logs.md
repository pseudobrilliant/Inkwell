# 0002. Rely on Keep the Rhythm for word logs, streaks and heatmaps

- **Status:** superseded by [0007](0007-inkwell-keeps-its-own-word-log.md)
- **Date:** 2026-11-21
- **Recorded:** 2026-11-25, after the fact
- **Specs:** practice-stats, piece-progress, contribution, ktr-integration (not yet written)

## Context

Progress needs time-based word counts: words this week on a story, streaks, a heatmap of a writing life. Counting words written per day means watching edits and keeping a log. The Keep the Rhythm plugin (KTR) already does this, with its own heatmap and entry blocks, and the writer already uses it.

## Decision drivers

- "Build only what's missing": Inkwell is the glue plus what doesn't exist elsewhere.
- "Plain notes, always": uninstalling Inkwell must lose nothing.
- Numbers must never be wrong in a way the writer can't see.
- Inkwell has to work fully without KTR.

## Considered options

1. **Inkwell keeps its own word log**, streaks and heatmap. Full control, but it rebuilds an existing plugin and adds a second, competing log.
2. **Rely on KTR, read-only and version-gated**: read KTR's `data.json`, embed its blocks, and hide KTR-based numbers when KTR is missing or on an untested version.
3. **Rely on KTR through its public API only**. KTR has no public API for daily logs, so this would leave out words this week and streaks.

## Decision

We chose **option 2**. All KTR access lives in `src/integrations/keep-the-rhythm.ts`. Inkwell never writes KTR data or settings. Stats show only on versions in `KTR_TESTED_VERSIONS` (0.2.16 when decided), and only draft and scene files count toward a piece.

## Consequences

- Good: no second word log, and less code. KTR's blocks work in any note.
- Bad: KTR's `data.json` is undocumented and may change. Every KTR update has to be checked against KTR's own views before its version is added.
- Bad (known risk): KTR's live history is per device (IndexedDB). When `data.json` syncs in from another device, KTR merges entries by an auto-numbered `id` that each device assigns on its own, so one device's day can overwrite another's. Expect undercounts across phone and desktop.
- Follow-up: if those undercounts prove unreliable in real use, write a new ADR for Inkwell's own word log, behind the same one-file interface.
