# Design

## Context

See proposal.md for why. Today: Vitest runs `tests/**/*.test.ts` in Node with `obsidian` aliased to a stand-in. `test-vault/` is gitignored and personal, so it can't be the e2e fixture. Plugin id is `inkwell`, `minAppVersion` 1.13.0, `isDesktopOnly: false`. Commands are registered as `inkwell:<id>` (e.g. `inkwell:quick-capture`, `inkwell:todays-journal`, `inkwell:open-home`). The timer shows `Ready · <n> min` when armed (`src/timer.ts`), as a status bar item on desktop and a header button on the timed note.

## Goals / Non-Goals

**Goals:**
- An agent can run `npm run e2e` locally and in CI and learn whether a UI flow works in real Obsidian, with no setup beyond `npm install`.
- Catch "works in the fake vault, breaks in Obsidian" bugs: plugin load errors, modals, views, header buttons, mobile layout.
- Keep the suite small (a handful of specs, a few minutes) so it is run, not skipped.

**Non-Goals:**
- Replacing unit tests, or testing logic that is already pure and tested in Vitest.
- Real devices, beta builds, screenshot diffing.

## Decisions

**1. Tool: `wdio-obsidian-service`.** It downloads a chosen Obsidian version, opens a fresh copy of a vault with the built plugin installed, and offers `browser.executeObsidianCommand`, `browser.reloadObsidian({vault})`, `obsidianPage.resetVault()` and `emulateMobile`. Alternatives: Playwright driving Electron through `--remote-debugging-port` (no version pinning, we'd write the vault copying and plugin install ourselves); manual testing only (the status quo this change replaces). Recorded in a new ADR 0005, since it adds a second test runner and is costly to swap later.

**2. Two runners, kept apart.** Vitest keeps `tests/**/*.test.ts`. E2E specs are `tests/e2e/specs/*.e2e.ts`, run by WebdriverIO with Mocha (WebdriverIO doesn't run under Vitest). The `.e2e.ts` suffix keeps Vitest's include from picking them up. `tests/e2e/tsconfig.json` adds Mocha and WebdriverIO types, and the root `tsconfig.json` excludes `tests/e2e/` so Mocha's globals never leak into unit tests or `npm run build`. `npm run spec`'s check accepts any path under `tests/`, so spec `Test:` lines can name e2e tests as `tests/e2e/specs/<file>.e2e.ts › "<name>"`.

**3. Fixture vault in the repo.** `tests/e2e/vaults/basic/`: a few plain notes (one exercise with `minutes: 10`, one journal-goal-relevant setup) and the Inkwell folders, committed. The service works on a copy, and each spec file starts with `reloadObsidian` or `resetVault` so specs don't depend on each other. Plugin settings for a test (journal goal, "Time practice writing") are set through `browser.executeObsidian` on the plugin instance, not by committing `data.json` (which `.gitignore` excludes anyway).

**4. Obsidian versions.** `browserVersion` from `OBSIDIAN_VERSIONS`, defaulting to `earliest` (= `minAppVersion`) locally for speed; CI runs a matrix of `earliest` and `latest`. Installer: `earliest`. Download cache in `.obsidian-cache/` (gitignored, cached in CI with `actions/cache`).

**5. Mobile.** One capability entry with `emulateMobile: true` and a phone-sized viewport runs the timer spec's mobile test (header button is the only timer UI, no status bar). It is emulation on desktop, not a real phone, which the spec scenario notes. Sync across devices isn't exercised: each run is one device. The timer's device-local storage (ADR 0003) starts empty in each fresh vault copy.

**6. Not in `npm run check`, but in CI.** `check` stays fast for the agent Stop hook. CI gets a separate `e2e` job so lint/test/build results come back first. On Linux the job runs under a virtual display (`xvfb-run`, or whatever the service's sample plugin workflow uses; confirmed in task 1.1).

**7. Lint.** E2E files are TypeScript in the repo, so `eslint .` covers them. The `obsidianmd` rules aimed at plugin code (e.g. `activeDocument` instead of `document`, sentence case) don't fit test code that runs in WebdriverIO's Node context; `eslint.config.mts` gives `tests/e2e/**` its own block with Node globals and turns off only the rules that don't apply there, via config (the project forbids inline disables).

## Risks / Trade-offs

- [Slow or flaky in CI] → keep the suite small, wait on elements with WebdriverIO's built-in waits rather than sleeps, and retry the job once before treating a failure as real.
- [First run downloads Obsidian (~100+ MB)] → cache `.obsidian-cache/` locally and in CI.
- [Mobile emulation isn't a real phone] → accepted; the writer still checks on the phone before a release. Real Android can be a later idea.
- [Obsidian updates break selectors] → select by Inkwell's own CSS classes, not Obsidian internals, wherever possible; the `latest` matrix entry flags breakage early.
- [Timer tests need real elapsed time] → only test what needs no waiting (arming, starting, stopping under a minute). Rounding and adding minutes stay unit-tested.

## Migration Plan

Additive. Rollback is removing `tests/e2e/`, `wdio.conf.mts`, the script, the CI job and the dev dependencies, and reverting the `Test:` lines.

## Open Questions

- Exact package versions and the CI virtual display setup: confirm against the service's docs and sample plugin when installing (task 1.1). Doesn't change the approach.
