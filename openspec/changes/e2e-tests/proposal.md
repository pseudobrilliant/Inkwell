# Proposal

## Why

Inkwell is mostly built by agents, and the unit tests run against an in-memory fake vault (`tests/helpers/fake-app.ts`). Nothing checks the plugin inside real Obsidian: that it loads, that modals and sidebar panels open, that the timer's header button appears, or that it behaves on a phone-sized screen. Today the only way to know is for the writer to try it, which takes time away from writing. Several writing-timer scenarios are `Test: none yet` for exactly this reason.

## What Changes

- Add a small end-to-end suite that launches real Obsidian on a throwaway copy of a fixture vault with the built plugin installed, using `wdio-obsidian-service` (WebdriverIO + Mocha).
- Add `npm run e2e` so an agent (or the writer) can run it locally. It is **not** part of `npm run check`, because it downloads Obsidian and is much slower.
- Add a CI job that runs the suite on every push, against the oldest supported Obsidian (`minAppVersion`, 1.13.0) and the latest release.
- Cover a few smoke flows: the plugin loads with no errors, quick capture saves a note to the Inbox, Home renders its blocks, and the writing timer arms, starts and logs as its spec says, including one run with mobile emulation.
- Point the writing-timer scenarios these tests cover at them, replacing `Test: none yet`.
- New ADR 0005 records the choice of test tool.

## Capabilities

### New Capabilities

None. This is test tooling: the writer sees no new behaviour.

### Modified Capabilities

None. No requirement changes. The writing-timer spec only gets its `Test:` lines updated to name the new tests, which `npm run spec` checks. The change sets `skip_specs: true`.

## Impact

- **ADRs:** none touched. Needs a new one, ADR 0005, because it adds a dev dependency, a CI job and a second test runner, and picks between real options.
- **Dependencies (dev only):** `wdio-obsidian-service`, `wdio-obsidian-reporter`, `@wdio/cli` and its Mocha framework, `mocha`, `@types/mocha`. Nothing ships in `main.js`.
- **Files:** new `tests/e2e/` (specs, a committed fixture vault, its own `tsconfig.json`), `wdio.conf.mts`, `package.json` scripts, `.gitignore` (Obsidian download cache), `.github/workflows/lint.yml`, `eslint.config.mts`, `openspec/specs/writing-timer/spec.md` (`Test:` lines only).
- **Out of scope:** real Android or iOS devices (needs Appium and an emulator), Obsidian beta builds (need Insiders credentials in CI), visual or screenshot diffs, and broad coverage. Logic stays tested in Vitest; e2e covers only what the fake vault can't. Nothing is added to any mode, so no mode gets heavier. The suite never touches the real writing vault.
