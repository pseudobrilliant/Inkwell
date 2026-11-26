# 0003. Keep writing timer state in device-local storage

- **Status:** accepted
- **Date:** 2026-11-25
- **Specs:** [writing-timer](../specs/writing-timer/spec.md)

## Context

The writing timer has to survive a reload and a phone putting Obsidian in the background. The first version kept the running timer in the plugin's settings file. That file syncs across devices, and the timer changes on every keystroke, so a phone and a desktop each overwrote the other's settings and timer, causing sync conflicts.

## Decision drivers

- Each device times its own writing. A timer running on the phone must not appear on, or be stopped from, the desktop.
- The settings file syncs, so fast-changing or per-device state must stay out of it.
- Exact time after backgrounding, where a ticking counter would drift.
- Mobile from day one: no desktop-only APIs.

## Considered options

1. **Synced settings file** (the original). Survives reloads, but syncs across devices and conflicts.
2. **Frontmatter of the timed note**. Visible and plain, but it rewrites the note on every change and syncs too.
3. **Device-local storage** (`app.saveLocalStorage`, key `inkwell-timer`), storing timestamps rather than a counter.

## Decision

We chose **option 3**. The state is timestamps (start of the current stretch, time counted before it, last keystroke), so elapsed time is worked out from the clock rather than counted. After a reload, a timer that was running is restored as paused, counting only up to the last keystroke. A timer found in the old settings file is adopted only if the device has none. Only the logged result, `writing_min`, goes into the note, once, when the timer stops.

## Consequences

- Good: no sync conflicts. Each device has its own timer, and time stays exact through backgrounding.
- Bad: a timer can't be started on one device and stopped on another.
- Bad: clearing the app's local storage loses a timer that hasn't been stopped. Minutes already logged are safe in the note.
- Follow-up: drop the old-settings adoption once no supported version wrote a timer to settings.
