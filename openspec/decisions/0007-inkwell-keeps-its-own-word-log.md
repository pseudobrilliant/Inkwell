# 0007. Inkwell keeps its own word log

- **Status:** accepted
- **Date:** 2026-11-26
- **Specs:** word-log, writing-blocks, practice-stats, piece-progress, contribution (all but writing-blocks not yet written)
- **Supersedes:** [0002](0002-rely-on-keep-the-rhythm-for-word-logs.md)

## Context

The [constitution](../constitution.md) makes word-count goals for each day and week core, counted through writing blocks and shown on Home. ADR 0002 put word logs, streaks and heatmaps in Keep the Rhythm (KTR). In use, that leaves three problems:

- KTR's live history is per device. When its `data.json` syncs in from another device, entries are merged by an auto-numbered `id`, so one device's day can overwrite another's. Numbers undercount across phone and desktop (ADR 0002's known risk).
- `data.json` is undocumented. Every KTR update has to be checked by hand before its version is allowed, and until then the stats are hidden.
- Goals, streaks and the heatmap would only work for writers who install KTR.

## Decision drivers

- Design principles 4 and 5: Inkwell counts the writing itself, and daily and weekly goals are core.
- Numbers must be the same on every device, and never wrong in a way the writer can't see.
- Plain notes, always: uninstalling Inkwell loses nothing, the log included.
- Mobile from day one, and sync across devices without overwrites.

## Considered options

1. **Keep KTR** as the source of word logs (ADR 0002). No new code, but the problems above stay, and goals depend on another plugin.
2. **Count the words in writing blocks, with no log.** Date each count by its note (today's exercise counts for today). No stored state, but edits to older pieces, such as revising a story, would never count toward the day.
3. **Inkwell's own word log, fed by writing blocks.** Inkwell records the net words typed in writing blocks, per note per day, in per-device log files in the vault, and adds them up. Full control over accuracy, sync and what counts.

## Decision

We chose **option 3**, as settled with the writer in [block-word-log](../ideas/block-word-log.md). Only typing in writing blocks counts; the first draft, programmatic rewrites and changes arriving by sync never do. Each device writes only its own log files and readers add them up, so sync can't overwrite a day. Inkwell takes inspiration from KTR but copies none of its data format, block syntax, settings or UI, and removes the KTR integration (`src/integrations/keep-the-rhythm.ts` and the KTR blocks on Home). Goals, streaks, the heatmap and per-piece words this week are built on the log.

## Consequences

- Good: one source for every number, the same on every device, with no version gate. Goals work for every writer.
- Good: Inkwell decides what counts, such as practice words for the day but never for a piece, without reading another plugin's settings.
- Bad: Inkwell rebuilds what KTR did: the log, streaks and heatmap.
- Bad: writing outside a block doesn't count, so blocks have to reach where writing happens: drafts, scenes and likely journals start with one, and moving work up keeps blocks instead of unwrapping them.
- Follow-up: the `block-word-log` change settles its open questions (KTR history, the streak, renames across devices). The KTR rules in CLAUDE.md describe the current code until that change lands.
