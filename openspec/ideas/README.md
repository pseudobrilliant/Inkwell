# Ideas

Open questions and possible features that nobody is working on yet. They live here, not in `openspec/changes/`, so that `changes/` only ever holds work in progress: `openspec list` shows what is active, and `openspec validate --all` passes. The OpenSpec CLI doesn't read this folder.

## Rules

- **One file per idea**, `<id>.md` in kebab-case. The id becomes the change id when it's picked up.
- **Keep it short:** Status, likely capabilities, ADRs, Why, what could change, and out of scope. No requirements, design or tasks yet.
- **Status:** `open` (free to pick up), `planned` (decided, waiting on another change) or `gated by ADR NNNN` (wait for the evidence that ADR names before picking it up).
- **Picking one up:** run `npx openspec new change <id>` (or the `openspec-propose` skill), start the proposal from the idea's Why and constraints, and delete the idea file in the same commit. Git keeps its history.
- **Dropping one:** delete the file. If the reason is worth keeping, write it in the commit message, or as a `rejected` ADR if it chose between real options.

## Index

Kept short on purpose: only ideas that build on what we're working on now (writing blocks). Other ideas were dropped on 2026-11-26 and are in git history.

| Idea | Status | Likely capabilities |
|---|---|---|
| [writing-block-timer](writing-block-timer.md) | open (after writing-blocks) | writing-timer, writing-blocks |
| [writing-block-types](writing-block-types.md) | open (after writing-blocks) | writing-blocks |
| [block-word-log](block-word-log.md) | planned (after writing-blocks) | word-log, contribution, piece-progress, writing-blocks |

### Gated

Not backlog. These hold the place an ADR's follow-up points to, and wait on its evidence.

| Idea | Status | Likely capabilities |
|---|---|---|
| [long-form-views](long-form-views.md) | gated by ADR 0004 | long-form |
