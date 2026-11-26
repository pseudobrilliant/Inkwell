# Decisions

Architecture Decision Records (ADRs) for Inkwell, in the [MADR](https://adr.github.io/madr/) style. Specs in `openspec/specs/` say **what** Inkwell does. These records say **why**, and which options were turned down.

## Rules

- **When to write one:** for a decision that would be hard to reverse, that a later change could undo without knowing why, or that picks one option over others that were worth considering. Small choices stay in commit messages.
- **Numbering:** the next free four-digit number, then a short kebab-case title. Copy `0000-template.md`.
- **Status:** `proposed` while being discussed, `accepted` once decided, `rejected` if it was turned down (keep it, so the idea isn't raised again without knowing why), `deprecated` when what it decided no longer exists, and `superseded by NNNN` once replaced.
- **Dates:** `Date` is when the decision was made. A decision written down later also gets `Recorded`, the date it was written.
- **Never rewrite an accepted record.** To change a decision, write a new ADR that supersedes it, and update only the old one's status line. Fixing a typo or a broken link is fine, and so is keeping the `Specs` line in step as specs are written or renamed.
- **Link both ways.** An ADR lists the specs it shapes, and a spec links its ADRs from its Purpose section.
- **OpenSpec changes:** a proposal that reverses or replaces an accepted ADR includes the new ADR. An idea in `openspec/ideas/` that is gated by an ADR waits for the evidence that ADR's follow-up names.

## Index

| # | Decision | Status | Date |
|---|---|---|---|
| [0001](0001-record-design-with-openspec-ears-and-adrs.md) | Record design with OpenSpec, EARS and ADRs | accepted | 2026-11-25 |
| [0002](0002-rely-on-keep-the-rhythm-for-word-logs.md) | Rely on Keep the Rhythm for word logs, streaks and heatmaps | superseded by 0007 | 2026-11-21 |
| [0003](0003-timer-state-in-device-local-storage.md) | Keep writing timer state in device-local storage | accepted | 2026-11-25 |
| [0004](0004-storyline-compatible-long-form.md) | Make long form compatible with StoryLine | accepted | 2026-11-20 |
| [0006](0006-writing-block-first-draft-in-a-comment.md) | Writing blocks are callouts, with the first draft in a comment | accepted | 2026-11-25 |
| [0007](0007-inkwell-keeps-its-own-word-log.md) | Inkwell keeps its own word log | accepted | 2026-11-26 |
| [0008](0008-word-log-is-per-device-monthly-notes.md) | The word log is per-device monthly notes | proposed | 2026-11-26 |
