# Design

## Context

See proposal.md for why. After the block-word-log change, every word number comes from `plugin.words` (`WordLog`, `src/wordlogstore.ts`), which adds up every device's log notes plus this device's unflushed buffer. The `inkwell-words` block draws `wordsSummary(days, today, weekStart)` (pure, `src/wordlog.ts`) from `plugin.words.allDays()`, the all-writing words per day. `inkwell-practice` draws `practiceWeek(plugin)` (`src/contribution.ts`), whose days are marked showed up when their all-writing words are above zero. Both are `LiveBlock`s, so they redraw when the vault changes. Words from typing reach the log through `WritingBlockHost.onBlockWords` → `plugin.words.add(path, words)`, about 2 seconds after the writer pauses.

## Goals / Non-Goals

**Goals:**
- Goal progress is a pure function of the per-day words, the goals and the week start, tested without a vault.
- The goals add nothing to notes. They're two numbers in the synced settings.
- The notice fires only for typing on this device, never for sync.

**Non-Goals:**
- No new code block. Goals show in the two blocks that already show words.
- No change to the log, its format or what counts as words written.

## Decisions

### 1. Goals live in the synced settings
`dailyWordGoal` and `weeklyWordGoal` are numbers in `InkwellSettings`, handled in `mergeSettings` (a value that isn't a whole number of 0 or more falls back to the default) and in `controlValue`/`applyControlValue`. They're number controls in the Words group, beside "Week starts on". The goals belong to the writer, not the device, so they sync. `onExternalSettingsChange` already reloads settings from another device.

*Alternatives:* goals in a note's frontmatter (a "goals" note), which would be plain and editable but is one more note to keep and parse; device-local goals, which would let the phone and desktop disagree about the same writer's day. Neither is worth it.

*Defaults:* 300 a day and 1,500 a week. That's five days at the daily goal, so the weekly goal can be met with two days off. These are an assumption, easily changed in the settings, and the README says how to turn either off.

### 2. One pure function for progress
`goalProgress(days, today, weekStart, goals)` in `src/wordlog.ts` returns, for each goal that's on: the words, the goal, the share of the goal reached (capped at 1 for the bar) and whether it's met; and, when the daily goal is on, the goal days this week. `wordsSummary` keeps its shape. The words block calls both on the same `allDays()` map, so there's one read of the log. A day is a goal day when its words are ≥ the daily goal, which is > 0 when the goal is on, so a goal day is always a showed-up day.

### 3. The practice strip marks goal days with a second class
`PracticeWeek.days` gets `goal: boolean` beside `showed`. The strip adds `is-goal` on top of `is-done`, styled as an inner ring on the showed-up day's accent fill (that fill is already full), so a showed-up day looks the same with or without a goal set. The aria-label says "goal met" for a goal day. No class or label exists for a missed goal (spec: "Goals don't scold").

### 4. The notice checks the crossing after each logged change
`WordLog.add(path, words)` is the only way typing reaches the log, and it's never called for sync or for Inkwell's own rewrites (spec word-log). After adding to the buffer, it reads today's and this week's all-writing totals (cached rows, so cheap), and works out the totals before this change by taking away `words`. A notice shows when *before < goal ≤ after*. Words that arrived by sync are already in *before*, so a goal reached on another device never crosses here.

`add` stays synchronous for its callers. The check runs after it, as a promise whose errors are logged, and only when the logged path counts toward all writing.

To show each notice at most once, the device keeps the last day and the last week it showed one in local storage (`inkwell-goal-notices`: `{ day: "YYYY-MM-DD", week: "YYYY-MM-DD" }`, the week by its first day). It's per device on purpose, as in ADR 0003: each device decides only whether it has shown its own notice, and a fast-changing value stays out of the synced settings.

The crossing rule (`goalReached(before, after, goal)`) and the once-only check are pure functions, tested on their own. The flow (typing words through `add`, a goal crossed, a notice, no second notice) is tested against the fake vault with the `Notice` stand-in.

*Alternative:* checking in the words block when it redraws. It would miss a phone with no Home open, and would fire for words arriving by sync.

### 5. How it works on mobile and across devices
Nothing here needs desktop APIs: the blocks are DOM, the notice is Obsidian's `Notice`, and local storage works on mobile. Across devices the totals already add up every device's log notes, so a goal shows the same progress everywhere once sync catches up. Until then, each device's view runs behind by the other's unsynced words, exactly as the words block does now.

## Risks / Trade-offs

- [The notice comes about 2 seconds after the words that crossed the goal, since words are logged after a pause] → That's when the writer has stopped typing, which is a better moment for a notice than mid-sentence.
- [Two devices both crossing the goal before syncing each other's words show the notice twice, once on each] → Accepted: each device saw its own writing reach the goal from what it knew.
- [A goal day counts net words, so a day of heavy revising can fall short] → Same as the streak and "showed up". It's the honest number from the log.
- [The defaults may be too high or too low for a given writer] → Both are one setting away, and 0 turns either off.

## Migration Plan

None. Nothing is released, and settings without the two keys get the defaults from `mergeSettings`.
