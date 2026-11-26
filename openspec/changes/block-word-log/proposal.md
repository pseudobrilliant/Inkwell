# Proposal

## Why

The [constitution](../../constitution.md) says Inkwell counts the writing itself, through writing blocks (design principle 4), as the base for daily and weekly goals (principle 5). Today every word number Inkwell shows comes from Keep the Rhythm (KTR). KTR undercounts across phone and desktop, needs a check by hand on every update, counts a block's hidden first draft unless a setting is on, and leaves writers without KTR with no words, no streak and no heatmap. [ADR 0007](../../decisions/0007-inkwell-keeps-its-own-word-log.md) decided Inkwell keeps its own word log. This change builds it, from the block-word-log idea (its file is deleted now that it's a change; git keeps its history).

## What Changes

- **A word log of Inkwell's own.** Only typing in writing blocks counts: the net change in a note's block words, per note per day, on each device. The first draft, programmatic rewrites (promote, "This became a story", mode switches) and changes arriving by sync never count.
- **Per-device log files in the vault.** Each device writes only its own files and readers add them all up, so sync can't overwrite a day. The files are plain, readable notes in a log folder (a new setting).
- **Every word number moves onto the log:** words this week on a story or project (story panel, Home in-progress list), practice words, words per mode in `inkwell-contribution`, the streak, and the days showed up in `inkwell-practice`.
- **The streak and "showed up" count block words only.** A day counts when the writer added words in writing blocks that day. Making an exercise or a journal alone no longer counts.
- **Inkwell's own heatmap.** `inkwell-heatmap` and the story panel heatmaps are drawn from the log, not by embedding KTR's block. A new `inkwell-words` block (today, this week, this month, streak) replaces `ktr-slots` on Home.
- **A word count on every block.** The block's toolbar shows its words, and once reviewed, the change since the first draft (6 words (+2)). It's a toolbar tool, like the timer.
- **A week-start setting** (Monday by default) replaces reading KTR's `startOfTheWeek`.
- **Blocks stay blocks when work moves up.** "This became a story" puts the exercise's current text in the new draft's writing block (without the first draft), and "Promote" puts each scene's text in a writing block. New drafts, scenes and journals start with a block. The story and project panels say when a draft or scene has no block, since its writing won't count, and offer to put it in one.
- **Keep the Rhythm is removed.** `src/integrations/keep-the-rhythm.ts`, `KTR_TESTED_VERSIONS`, the settings section, the "Don't count comments" notice, the `ktr-check` skill, and the KTR blocks in the built-in Home and journal templates. The log starts fresh: KTR's history isn't imported. Nothing has been released, so there's no upgrade path to keep, but notes that already exist are never rewritten (safe by default).

Out of scope:
- **Daily and weekly word goals.** They're the next change ([word-goals](../../ideas/word-goals.md)), built on this log.
- **Minutes in the log.** The format leaves room for them, but the timer stays as it is ([writing-block-timer](../../ideas/writing-block-timer.md)).
- **Counting writing outside blocks.** Plain-text drafts stop adding words until they're put in a block.
- **No new weight on a lighter mode.** Practice still gets one block per note. Short form still gets one draft, now with a block in it.

## Capabilities

### New Capabilities
- `word-log`: what counts as words written, how the log is kept on each device and added up across them, and the numbers built on it: words per day, week and mode, words this week on a piece, the streak and days showed up, the heatmap, and the `inkwell-words` block.

### Modified Capabilities
- `writing-blocks`: the "Keep the Rhythm comment setting" requirement is removed. "Moving work up" changes so blocks stay blocks. New requirements make the built-in draft, scene and journal templates start with a block, offer "Put in a writing block", and put a word count on every block's toolbar.

## Impact

- **Constitution:** serves design principles 4 (Inkwell counts the writing itself) and 6 (Home is where progress is seen), and lays the ground for 5 (goals). Tenets: plain notes (the log is readable notes), mobile (Vault API only), safe by default (moving work up still archives first).
- **ADRs:** builds what ADR 0007 decided. ADR 0003 (device-local state) applies to the device id. ADR 0006 (first draft in a comment) still holds: the first draft is never counted. ADR 0004 is unaffected: scenes keep StoryLine's frontmatter, and a block in a scene's body is plain Markdown. No new ADR is needed unless the log's file format turns out to need one (see design).
- **Code:** new `src/wordlog.ts` (pure: entries, parsing, merging, sums, streak, week start), `src/integrations/` loses `keep-the-rhythm.ts`, new `src/wordlogstore.ts` (vault files, device id), a hook in the block editor that reports user edits, and changes in `src/contribution.ts`, `src/homeblocks.ts`, `src/storyview.ts`, `src/home.ts`, `src/templates.ts`, `src/became.ts`, `src/promote.ts`, `src/stories.ts`, `src/projects.ts`, `src/blockhost.ts`, `src/settings.ts`, `src/main.ts`.
- **Tests:** `tests/keep-the-rhythm.test.ts` is replaced by `tests/wordlog.test.ts`. `became`, `promote` and template tests change.
- **Docs:** README (KTR sections, Home, practice), CLAUDE.md (progress table, KTR rules removed, data model), `.claude/skills/ktr-check/` removed, `openspec/config.yaml` capability list.
