# 0001. Record design with OpenSpec, EARS and ADRs

- **Status:** accepted
- **Date:** 2026-11-25
- **Specs:** all

## Context

Inkwell's design lived in CLAUDE.md, which mixed three things: what the plugin does, why it was built that way, and the engineering rules. Its "Open questions" section worked as an informal propose-then-settle flow, but it had no structure, no history, and no link to tests. Inkwell is an existing, working codebase built by one person with AI coding assistants, so the design records have to describe the system as it is now and stay true as it changes.

## Decision drivers

- Describe current behaviour in one place per capability, not spread over feature history.
- Light enough for a solo project ("Each mode is as light as its purpose" applies to process too).
- Requirements precise enough to map onto Vitest tests.
- Keep the reasons behind decisions, including rejected options, so later changes don't undo them by accident.
- Works with Claude Code.

## Considered options

1. **OpenSpec**: living specs per capability, changed through proposals that merge into them when archived. Built for existing codebases.
2. **Spec Kit**: one folder per feature (spec, plan, tasks) plus a constitution. Good for new features built from scratch, but it leaves no single current description of each capability.
3. **BMAD**: AI roles (analyst, PM, architect, scrum master, dev, QA) producing a PRD, architecture and stories. Built for teams and large greenfield products. Too heavy here.
4. **Kiro-style specs** (requirements, design, tasks per feature, with EARS requirements). Precise, but organized by feature like Spec Kit.
5. **Keep CLAUDE.md only**: no new tooling, but no history, no validation and no link to tests.

## Decision

We chose **OpenSpec** for behaviour, with requirements written as **EARS** sentences (borrowed from Kiro), and **MADR-style ADRs** in `openspec/decisions/` for the reasons behind decisions. OpenSpec's CLI validates specs in `npm run check` and CI. Each scenario names the test that covers it, or says `Test: none yet`. Conventions live in `openspec/config.yaml`.

## Consequences

- Good: one current spec per capability; open questions become proposals with history; gaps in test coverage are visible in the specs.
- Good: CLAUDE.md gets shorter as capabilities move into specs, and keeps the tenets and engineering rules.
- Bad: a new dev dependency (`@fission-ai/openspec`), which collects anonymous usage stats unless `OPENSPEC_TELEMETRY=0` is set (the npm script sets it).
- Bad: specs and code can drift. The rule is to update a spec in the same commit as the behaviour change.
- Follow-up: piloted on the writing timer. Review the format before writing the other capability specs.
