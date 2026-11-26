# 0005. End-to-end tests with wdio-obsidian-service

- **Status:** proposed
- **Date:** 2026-11-25
- **Specs:** writing-timer (its `Test:` lines name e2e tests)

## Context

Inkwell is mostly built by agents. Unit tests run in Node against a fake vault, so nothing checks the plugin inside real Obsidian: loading, modals, views, header buttons, mobile layout. Until now the writer found those bugs by hand. Change `e2e-tests` adds a small suite that runs in real Obsidian.

## Decision drivers

- An agent must be able to run it with no setup beyond `npm install`, locally and in CI.
- Test against the oldest supported Obsidian (`minAppVersion`) and the latest.
- Mobile from day one: some check of the phone layout.
- Never touch a real vault.
- Keep unit tests where they are (Vitest).

## Considered options

1. **wdio-obsidian-service** (WebdriverIO + Mocha): downloads a chosen Obsidian version, installs the built plugin into a fresh copy of a fixture vault, runs commands, can emulate mobile.
2. **Playwright driving Electron** over `--remote-debugging-port`: general-purpose, but no version pinning, and vault copying and plugin install would be ours to write.
3. **Manual testing only:** the status quo.

## Decision

We chose **wdio-obsidian-service**, because it is built for Obsidian plugins and covers version pinning, vault isolation and mobile emulation out of the box, which are the parts we'd otherwise have to write and maintain.

## Consequences

- Good: agents can check UI flows themselves; breakage on a new Obsidian release shows up in CI.
- Bad: a second test runner (Mocha under WebdriverIO) beside Vitest, more dev dependencies, a slower CI job, and an Obsidian download to cache.
- Follow-up: if the suite gets flaky or slow enough that it's skipped, revisit its scope before adding to it. Real Android testing (Appium) is a separate decision if it's ever wanted.
