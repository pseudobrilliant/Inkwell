# Ideas

Open questions and possible features that nobody is working on yet. They live here, not in `openspec/changes/`, so that `changes/` only ever holds work in progress: `openspec list` shows what is active, and `openspec validate --all` passes. The OpenSpec CLI doesn't read this folder.

## Rules

- **One file per idea**, `<id>.md` in kebab-case. The id becomes the change id when it's picked up.
- **Keep it short:** Status, likely capabilities, ADRs, Why, what could change, and out of scope. No requirements, design or tasks yet.
- **Status:** `open` (free to pick up) or `gated by ADR NNNN` (wait for the evidence that ADR names before picking it up).
- **Picking one up:** run `npx openspec new change <id>` (or the `openspec-propose` skill), start the proposal from the idea's Why and constraints, and delete the idea file in the same commit. Git keeps its history.
- **Dropping one:** delete the file. If the reason is worth keeping, write it in the commit message, or as a `rejected` ADR if it chose between real options.

## Index

| Idea | Status | Likely capabilities |
|---|---|---|
| [capture-habit-signal](capture-habit-signal.md) | open | contribution, capture |
| [contribution-trends](contribution-trends.md) | open | contribution |
| [fetch-link-titles](fetch-link-titles.md) | open | capture, resources |
| [long-form-views](long-form-views.md) | gated by ADR 0004 | long-form |
| [manuscript-view](manuscript-view.md) | open | long-form |
| [own-word-log](own-word-log.md) | gated by ADR 0002 | ktr-integration, practice-stats, piece-progress, contribution |
| [reading-habit-signal](reading-habit-signal.md) | open (after record-resource-finished-date) | contribution, resources |
| [record-resource-finished-date](record-resource-finished-date.md) | open | resources, contribution |
| [shared-cast](shared-cast.md) | open | short-form, long-form |
| [timer-for-drafts-and-scenes](timer-for-drafts-and-scenes.md) | open | writing-timer, piece-progress |
| [weekly-review](weekly-review.md) | open | capture, practice, short-form, piece-progress |
| [writing-blocks](writing-blocks.md) | open | writing-blocks (new), practice, writing-timer, movement, ktr-integration |
| [writing-life-view](writing-life-view.md) | open | contribution, short-form, long-form |
