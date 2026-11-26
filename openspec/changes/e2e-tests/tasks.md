# Tasks

## 1. Setup

- [ ] 1.1 Install dev dependencies (`wdio-obsidian-service`, `wdio-obsidian-reporter`, `@wdio/cli`, `@wdio/local-runner`, `@wdio/mocha-framework`, `mocha`, `@types/mocha`), checking current versions and the sample plugin (`jesse-r-s-hines/wdio-obsidian-service-sample-plugin`) for its config and CI workflow; verify `npm ci` and `npm run check` still pass
- [ ] 1.2 Add `wdio.conf.mts` (plugin `.`, vault `tests/e2e/vaults/basic`, `browserVersion` from `OBSIDIAN_VERSIONS` defaulting to `earliest`, installer `earliest`, cache `.obsidian-cache/`, Mocha, a desktop and an `emulateMobile` capability), add `.obsidian-cache/` to `.gitignore`, and add `"e2e": "npm run build && wdio run ./wdio.conf.mts"` to `package.json`; verify `npm run e2e` launches Obsidian with an empty spec
- [ ] 1.3 Add `tests/e2e/tsconfig.json` (Mocha and WebdriverIO types), exclude `tests/e2e/` from the root `tsconfig.json`, and add a `tests/e2e/**` block to `eslint.config.mts` (Node globals, plugin-only rules off by config); verify `npm run lint` and `npm run build` pass with an e2e file present
- [ ] 1.4 Commit the fixture vault `tests/e2e/vaults/basic/` (Inkwell folders, one exercise with `minutes: 10`); verify `npm run e2e` opens it and the real `test-vault/` and writing vault are untouched

## 2. Smoke specs

- [ ] 2.1 `tests/e2e/specs/load.e2e.ts` › "loads with no errors": Inkwell is enabled and no error is logged on load; verify it passes on `earliest` and `latest`
- [ ] 2.2 `tests/e2e/specs/capture.e2e.ts` › "quick capture saves an idea to the inbox": run `inkwell:quick-capture`, type, save, and a `type: capture` note exists in `00 - Inbox`; verify it passes
- [ ] 2.3 `tests/e2e/specs/home.e2e.ts` › "home renders its blocks": run `inkwell:open-home`, and the inbox, in-progress, prompt and practice blocks render without an error message; verify it passes

## 3. Writing timer specs

- [ ] 3.1 `tests/e2e/specs/timer.e2e.ts` › "opening today's journal arms the timer with the journal goal": set the journal goal to 10, run `inkwell:todays-journal`, and the timer reads "Ready · 10 min"; point that writing-timer scenario's `Test:` line at it; verify `npm run spec` and the test pass
- [ ] 3.2 Same file › "auto-start off arms no timer" and › "starting by command creates a running timer": cover "Auto-start off" and "Starting by command"; update both `Test:` lines; verify `npm run spec` and the tests pass
- [ ] 3.3 Same file › "stopping under a minute logs nothing": start, type, stop, and `writing_min` is unchanged with a notice; add it to the "Under a minute" scenario's `Test:` line next to the unit test; verify `npm run spec` and the test pass
- [ ] 3.4 Mobile capability › "on mobile the header button is the only timer UI": no status bar item, header button opens the full menu; update the "Mobile" scenario's `Test:` line, noting it's emulated; verify `npm run spec` and the test pass

## 4. CI

- [ ] 4.1 Add an `e2e` job to `.github/workflows/lint.yml` (matrix `earliest` and `latest`, `actions/cache` for `.obsidian-cache/`, virtual display on Linux as the sample plugin does); verify the job passes on a pushed branch

## 5. Docs, ADR, check

- [ ] 5.1 Update CLAUDE.md's Build, test, release section (`npm run e2e`, when to run it, where e2e tests live, not in `check`) and the Tests paragraph; add a short "Testing" note to the README for contributors; verify both read correctly
- [ ] 5.2 Mark ADR 0005 accepted and add it to `openspec/decisions/README.md`; verify `npm run spec` passes
- [ ] 5.3 Run `npm run check` and `npm run e2e`; verify both pass

## Workflow follow-up

- Archive the change with `npx openspec archive e2e-tests` once it's merged.
