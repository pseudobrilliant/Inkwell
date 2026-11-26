# Tasks

Before starting, the `writing-blocks` change should be finished and archived (its phone checks 5b.2, 5c.2 and 6.3 are still open), so this change builds on the merged `writing-blocks` and `writing-timer` specs. Test lines named below are already in `specs/writing-timer/spec.md`. Check that each named test exists once it's written, since `npm run spec` checks them only after archiving.

## 1. Pure decisions

- [ ] 1.1 In `src/writingblocks.ts`, add `drafting(block)` (Draft mode with no kept first draft) and `draftingAt(text, pos)`, using the same body-line lookup as `writingAt`. Add these tests to `tests/writingblocks.test.ts`:
  - "drafting means Draft mode before review"
  - "draftingAt is false in a reviewed block and outside blocks"

  Verify `npm test`.
- [ ] 1.2 In `src/timerstate.ts`, add `timing(type, text)`, `hasDraftLeft(text)` and `countsAsTyping(timing, text, pos)`. Add these tests to `tests/timerstate.test.ts`, with the names the spec uses:
  - "typing outside a Draft block is not drafting"
  - "typing in a reviewed block is not drafting"
  - "drafting in either of two blocks counts"
  - "drafting in a block starts the timer"
  - "a journal or an exercise without a block is timed as a whole note"
  - "only exercises are timed by block"
  - "an exercise whose blocks are all reviewed has nothing to draft"

  Verify `npm test`.
- [ ] 1.3 In `src/timerstate.ts`, add `afterFirstReview(state, path, text)` and `goalProgress(state, now)`. Add these tests:
  - "goal progress is the share of the goal written" (a quarter at 2:30 of 10, null with no goal, capped at 1 past the goal)
  - pure cases for `afterFirstReview`: matching path logs, a remaining Draft block re-arms with the same goal, another path does nothing

  Verify `npm test`.

## 2. Toolbar tools in the block code

- [ ] 2.1 In `src/writingblocktoolbar.ts`, add `BlockTool` and `WritingBlockHost.tools`. Give `renderToolbar` a `{ sourcePath }` context, and draw each tool into its own `span.inkwell-wb-tool` before the modes. Draw no tools without a source path. Pass the path from `ToolbarWidget.toDOM` and `renderedToolbars` (`editorInfoField`) in `src/writingblockeditor.ts`, and from `ctx.sourcePath` in `src/writingblockview.ts`. Keep `ToolbarWidget.eq` as is. Verify `npm run lint` (the decision 10 import rule still passes) and `npm run build`.
- [ ] 2.2 Change `onFirstDraftSaved()` to `onFirstDraftSaved({ sourcePath, text })` in all three switch paths: `switchInView`, `switchInEditor` (the command and editor-menu callers in `src/blockhost.ts` pass the view's file), and `switchInFile`. Keep the KTR notice working. Verify `npm run build`, then by hand in `test-vault`: the KTR notice still appears on the first review with KTR's setting off.

## 3. The timer as a tool

- [ ] 3.1 In `src/timer.ts`, make `onType` take the editor and count a keystroke only when `countsAsTyping` says so. Keep the in-memory `path → timing` map, filled from typing and from `cachedRead` when a note is opened or the timer is restored. On opening an exercise, skip arming when it has blocks and none is still drafting. Verify `npm test` and `npm run build`.
- [ ] 3.2 Add `blockReviewed(path, text)` to `WritingTimer`: stop and log, then re-arm with the same goal when `hasDraftLeft(text)`. Call it from `src/blockhost.ts`'s `onFirstDraftSaved`. Extend `fakePlugin()` in `tests/helpers/` with what `WritingTimer`'s constructor needs (`addStatusBarItem`, workspace `on`, `onLayoutReady`). Create `tests/timer.test.ts` against the fake vault with:
  - "first review stops the timer and logs its minutes" (`writing_min` 5 → 17)
  - "first review re-arms when another block is still in draft"
  - "switching a reviewed block's mode leaves the timer alone"
  - "reviewing in another note leaves the timer alone"

  Verify `npm test`.
- [ ] 3.3 Add the timer `BlockTool` in `src/timer.ts`, registered in `src/blockhost.ts`:
  - shown only in exercises timed by block, on Draft blocks before review
  - the ring (`createSvg`, `pathLength="100"`, `stroke-dashoffset` attribute) when there's a goal, plus the time
  - a tap opens `menu()`, which offers only "Start now" when there's no timer
  - hidden when the timer belongs to another note
  - elements kept in a set the 1-second tick updates and prunes by `isConnected`

  Add the ring and tool CSS to `styles.css` with Obsidian variables only. Verify `npm run lint` and `npm run build`.
- [ ] 3.4 In `render()`, skip the header button for notes timed by block. The status bar is unchanged. Verify by hand in `test-vault`: an exercise with a block has no header button, and a journal and an older exercise still do.
- [ ] 3.5 By hand in `test-vault`, desktop and phone. Record the results in this file. Check each of these:
  - the toolbar timer in Live Preview with the cursor in and out of the block, and in reading view
  - the ring at a quarter, full at the goal and after, and no ring with no goal
  - typing in the prompt or reflection doesn't start or resume it
  - two Draft blocks show the same time
  - first review logs and, with a second Draft block, re-arms
  - another note's timer isn't shown
  - starting from the toolbar with "Time practice writing" off
  - the editor doesn't lose the cursor or flicker as the clock ticks

  Then set the "Reviewed blocks show no timer", "Starting from the toolbar" and "Another note's timer" Test lines to note they were checked by hand.

## 4. Docs and check

- [ ] 4.1 Update the README: in exercises, the timer lives in the writing block's toolbar, counts only drafting, and logs on first review. Update CLAUDE.md:
  - the Practice "Writing timer" bullet
  - the writing blocks "Next" line (the timer is done, block types remain)
  - the settings description in `src/settings.ts` (`timerAutoStart`) if its wording no longer fits

  Verify all three read correctly.
- [ ] 4.2 No new ADR in this change. Confirm `openspec/decisions/README.md` needs no change. Run `npm run check` and verify it passes with zero lint errors.

## Workflow follow-up

- Archive with `npx openspec archive writing-block-timer` after review, then verify `npm run spec` checks the merged Test lines.
