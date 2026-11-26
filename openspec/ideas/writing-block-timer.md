# Writing block timer

- **Status:** open (after the writing-blocks change)
- **Likely capabilities:** writing-timer, writing-blocks
- **ADRs:** ADR 0003 (timer state stays device-local) still applies.

## Why

The writing block's first step is Write, then Review, then Read. Timing belongs to the first write, and to the block: minutes should measure writing, not reading the prompt or reflecting afterwards. Today the timer times the whole exercise or journal note.

## What could change

- The timer lives in the writing block's toolbar, as the first tool there.
- It times the Writing mode only: it starts on the first keystroke inside the block, and Review and Edited aren't counted.
- In a note with a writing block, the block timer replaces the note-level timer. Notes without a block, such as journals today, keep the note timer.
- Stopping adds the minutes to the note's `writing_min` when the note has that property.

## Open questions

- What happens with two blocks in one note?
- What does a note without `writing_min` do with the minutes: add the property, or not log them?
- Does a timer goal (the exercise's `minutes`) show in the toolbar?

## Out of scope / constraints

One timer at a time still holds. Practice minutes never count toward a piece's progress.
