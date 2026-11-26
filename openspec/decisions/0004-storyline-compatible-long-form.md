# 0004. Make long form compatible with StoryLine

- **Status:** accepted
- **Date:** 2026-11-20
- **Recorded:** 2026-11-25, after the fact
- **Specs:** long-form, movement (not yet written)

## Context

Long-form projects need scenes, a codex, and views such as a timeline, plot grid and corkboard. The StoryLine plugin already provides those views for notes with its frontmatter. Stories that grow get promoted from short form to long form, so field names have to carry across without renaming.

## Decision drivers

- "Build only what's missing": use StoryLine for advanced long-form views.
- Promotion from short form to long form needs no field renaming.
- "Plain notes, always": a project must open in StoryLine with or without Inkwell.
- Reordering scenes should rewrite as few files as possible, which matters for sync.

## Considered options

1. **Inkwell's own long-form schema and views.** Full control, but it rebuilds StoryLine and locks projects to Inkwell.
2. **StoryLine-compatible notes, with Inkwell as the glue.** Use StoryLine's frontmatter (`title`, `bookId`, `language`, `target_wordcount`, scene `sequence`, `act`, `chapter`, `status`, `pov`, …), its file names (`<act>-<sequence> <title>`) and its default statuses (`idea, outlined, draft, written, revised, final`).
3. **Compatible with StoryLine through a mapping layer** that translates Inkwell's own names. More flexible, but every field needs mapping both ways.

## Decision

We chose **option 2**, tested against StoryLine 1.11.12. `target_wordcount` is used everywhere, short form included, so promotion renames nothing. Scene `sequence` uses gaps of 10 (10, 20, 30, …), so moving a scene usually rewrites one file. `type: location` replaces `place`, which is still read as an alias. Long-form views in Inkwell (corkboard, kanban, beat sheets, scene inspector) are gated: built only if StoryLine falls short in real use, with the gap written down first.

## Consequences

- Good: projects work in StoryLine directly, and promotion is a move, not a migration.
- Bad: StoryLine updates can change its schema. Check compatibility on each StoryLine update.
- Bad: Inkwell's long-form field names are not its own to change.
- Follow-up: record any gap found in StoryLine in the [long-form-views](../ideas/long-form-views.md) idea before building a view.
