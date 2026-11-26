# Block word log

- **Status:** planned (after the writing-blocks change)
- **Likely capabilities:** word-log (new), contribution, piece-progress, practice-stats, writing-blocks
- **ADRs:** Replaces [ADR 0002](../decisions/0002-rely-on-keep-the-rhythm-for-word-logs.md) (rely on Keep the Rhythm). The writer decided to replace KTR, which answers 0002's gate; picking this up means a new ADR that supersedes 0002. ADR 0006 (first draft in a comment) still applies.

## Directive

We take inspiration from Keep the Rhythm and make our own version that fits Inkwell. We are not copying KTR: not its data format, its block syntax (`ktr-heatmap`, `ktr-slots`, `ktr-entries`), its settings or its UI. Each piece is designed from Inkwell's own tenets: writing blocks, plain notes, mobile from day one, and honest counts across devices.

## Why

- KTR undercounts across phone and desktop: its history is per device, and it merges by an id each device assigns, so one device's day can overwrite another's.
- KTR counts the first-draft comment unless the writer turns on "Don't count comments" (ADR 0006).
- KTR watches every file. Writing blocks give Inkwell an exact surface: the writing is the block text, and nothing else needs counting.

## Settled with the writer (2026-11-26)

- **Replaces KTR** as the only source for words, streak and heatmap.
- **Only typing in writing blocks counts:** net words per note per day, from the words in the note's blocks (`findBlocks`, `countWords`). The first draft is never counted. Programmatic rewrites and changes arriving by sync don't count.
- **Blocks stay blocks when work moves up:** "This became a story" and "Promote" stop unwrapping blocks, and new drafts and scenes start with a block.
- **Per-device log files in the vault:** each device writes only its own files, and readers add them up, so sync can never overwrite a day.
- **Words now, minutes later:** the log format leaves room for minutes; the timer itself stays [writing-block-timer](writing-block-timer.md).

## Open questions

- What counts toward the streak: block words only, or also an exercise or journal made that day?
- Does "This became a story" keep the exercise's first draft in the story's block, or start fresh?
- Import KTR's history once, or start fresh?
- Do journals get a writing block in their template, so journaling counts?
- A rename seen on another device: how do that device's log entries follow?

## Out of scope / constraints

Plain files: uninstalling Inkwell loses nothing. Mobile, using the Vault API only. Practice writing never counts toward a piece's progress.
