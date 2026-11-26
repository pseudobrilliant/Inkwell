# Proposal

## Why

A writing block goes Draft, then Review, then Edited, and timing belongs to the first write. Today the writing timer times the whole exercise note, so it also counts typing in the prompt, notes and reflection, and revising after review. Minutes should measure drafting. The block's toolbar was built to hold tools (writing-blocks design decision 9), and the timer is meant to be the first.

Picked up from the `writing-block-timer` idea. Its open questions were settled with the writer on 2026-11-26.

## What Changes

- **The timer becomes a tool in the writing block's toolbar** in exercises. It shows the elapsed time and a progress ring that fills toward the exercise's `minutes` goal. With no goal there is no ring. A tap opens the timer's menu (start or pause, reset, stop and log minutes, discard).
- **Only drafting counts.** In an exercise with a writing block, the timer starts and resumes only on keystrokes in the writing of a block in Draft mode that hasn't been reviewed yet. Typing anywhere else in the note, or in a block in Review or Edited, doesn't start or resume it, and the idle pause handles the rest.
- **Still one timer per note.** Two Draft blocks in one exercise share the note's timer, and every Draft block's toolbar shows it.
- **Reviewing ends the draft.** The first time a block enters Review, the timer stops and logs its minutes to the exercise's `writing_min`. If another block in the note is still in Draft, the timer is then armed again for the note.
- **The header button goes away in exercises with a block**, because the toolbar takes its place. The desktop status bar still shows the timer.
- **Unchanged:** journals, and exercises with no writing block (older notes, custom templates), keep today's note-level timer and header button. Blocks in other notes (drafts, scenes, any other note) show no timer.
- **Exercises whose blocks are all reviewed** are not armed when opened, since there's nothing left to draft. Manual start still works.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `writing-timer`: arming skips exercises with nothing left to draft. In exercises with a block, starting and resuming on typing are limited to Draft-mode block writing. A new requirement stops and logs on first review. "Where the timer shows" gains the block toolbar tool with its progress ring, and drops the header button in those notes.

The `writing-blocks` capability is still an open change, not yet in `openspec/specs/`, so its "Block toolbar" requirement isn't modified here. It already says the toolbar shows the modes, and tools are added next to them. The timer tool is specified in `writing-timer`, because it is the timer's behaviour.

## Impact

- **ADRs:** ADR 0003 (timer state in device-local storage) still applies unchanged: the timer is still one device-local state for one note, and nothing about a block is stored with it. ADR 0006 (block format) is unchanged: the timer writes nothing into the block. No new ADR is needed. The way tools plug into the toolbar is internal to the code and easy to change.
- **Depends on:** the `writing-blocks` change (toolbar, modes, `WritingBlockHost`). Archive it first, so `npm run spec` checks this change against the merged specs.
- **Code:**
  - `src/writingblocktoolbar.ts`: toolbar tools supplied by the host, the source note's path passed to tools, and the first-review callback given the note's path and text.
  - `src/writingblockeditor.ts`, `src/writingblockview.ts`: pass the source path to the toolbar.
  - `src/writingblocks.ts`: a pure "drafting here" check.
  - `src/timerstate.ts`, or a new pure helper: which kind of timing a note gets.
  - `src/timer.ts`: block-aware typing, the toolbar tool and ring, stopping on first review, hiding the header button.
  - `src/blockhost.ts`: wire the timer tool and the review callback.
  - `styles.css`: the ring.
- **Tests:** additions to `tests/writingblocks.test.ts` and `tests/timerstate.test.ts`, plus a new fake-vault test for stopping on review.
- **Out of scope:**
  - A block timer for journals, drafts, scenes or other notes. This can come later. Minutes on a draft or scene would show nowhere, and piece progress is counted in words, so the counting rule (practice never counts toward a piece) is untouched.
  - Timing revision (Review and Edited).
  - Per-block minutes, and any timer state stored in the note or the block header.
  - More than one timer at a time.
  - Moving journals to writing blocks.
- **Weight on a lighter mode:** none. Practice gets no new fields, settings or notes. The toolbar gains one control in exercises and loses nothing elsewhere.
