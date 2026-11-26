# Spec Delta

## Purpose

A writing block marks the writing in a note, apart from the prompt, goal and reflection around it, so Inkwell can help with it. Its first feature is review: write, see what changed while revising, then read the result, with the first draft kept in the same note.

Decisions behind this spec: [ADR 0002](../../decisions/0002-rely-on-keep-the-rhythm-for-word-logs.md), [ADR 0006](../../decisions/0006-writing-block-first-draft-in-a-comment.md).

## ADDED Requirements

### Requirement: Block format
Inkwell SHALL treat a callout of type `writing` (`> [!writing]`, with an optional title after it) as a writing block, in any note. The block's lines hold the writing as it is now, including lines without `>` that Markdown joins to the callout. The block SHALL be plain Markdown that reads as a callout without Inkwell.

#### Scenario: A writing callout is a writing block
- **GIVEN** a note containing `> [!writing] Opening` followed by `> The chapel door had never had a lock.`
- **WHEN** Inkwell reads the note
- **THEN** it finds one writing block titled "Opening" whose text is "The chapel door had never had a lock."

Test: tests/writingblocks.test.ts › "finds a writing callout and its text"

#### Scenario: A line without > straight after the writing
- **GIVEN** a writing block whose last line is followed directly by a line of text with no `>`
- **WHEN** Inkwell reads the note
- **THEN** that line is part of the block, as Obsidian shows it

Test: tests/writingblocks.test.ts › "includes text straight after a line of writing, as Obsidian shows it"

#### Scenario: Two blocks in one note
- **GIVEN** a note with two writing callouts separated by other text
- **WHEN** Inkwell reads the note
- **THEN** it finds two blocks, each with its own text and mode

Test: tests/writingblocks.test.ts › "finds two blocks, each with its own mode"

### Requirement: New writing block
WHEN the writer runs "New writing block", Inkwell SHALL insert an empty writing block at the cursor, or, IF text is selected, THEN wrap the selected lines in a writing block, keeping their words and paragraph breaks.

#### Scenario: Empty block at the cursor
- **WHEN** the writer runs "New writing block" with nothing selected
- **THEN** `> [!writing]` and one empty block line are inserted at the cursor, with the cursor on the empty line

Test: tests/writingblocks.test.ts › "inserts an empty block with the cursor on its line" [the command is checked by hand]

#### Scenario: Wrapping a selection
- **GIVEN** two selected paragraphs
- **WHEN** the writer runs "New writing block"
- **THEN** they become one writing block with the same words and both paragraphs

Test: tests/writingblocks.test.ts › "wraps a selection, keeping words and paragraphs" [the command is checked by hand]

### Requirement: Convert a tabbed block
WHEN the writer runs "New writing block" with the cursor in a run of tab-indented lines and nothing selected, Inkwell SHALL convert that run into a writing block, removing the leading tabs, keeping every word and each line as its own paragraph.

#### Scenario: Old tabbed writing becomes a block
- **GIVEN** two lines that each start with a tab, as in today's indented writing
- **WHEN** the writer puts the cursor in them and runs "New writing block"
- **THEN** they become a writing block with two paragraphs and no leading tabs

Test: tests/writingblocks.test.ts › "converts tab-indented lines into a block" [the command is checked by hand]

### Requirement: Look
Inkwell SHALL show a writing block as a box in a typewriter font (falling back to the editor's monospace font) with a first-line indent on every paragraph, with no callout title or icon; the block's toolbar takes the title's place. It SHALL look the same in reading view and in Live Preview, whether the cursor is inside the block or not.

#### Scenario: Paragraphs are indented
- **GIVEN** a writing block with two paragraphs
- **WHEN** the writer views it in Live Preview or reading view
- **THEN** both paragraphs start indented, in the typewriter font, with no "Writing" title

Test: none yet [checked by hand in test-vault]

#### Scenario: Moving into the block changes nothing
- **GIVEN** a writing block in Live Preview
- **WHEN** the writer clicks into it, then clicks out
- **THEN** the box, font and indents stay the same

Test: none yet [checked by hand in test-vault]

### Requirement: Writing inside the block
WHILE the cursor is inside a writing block in Live Preview, Inkwell SHALL hide the block's Markdown (the `> [!writing]` header line and the `> ` starting each line), and the cursor SHALL never land inside it. Source mode SHALL show the Markdown.

#### Scenario: Typing shows only the writing
- **GIVEN** a writing block in Live Preview
- **WHEN** the writer clicks into it and types
- **THEN** no `>` or `[!writing]` is visible, and arrow keys move only through the writing

Test: none yet [checked by hand in test-vault]

### Requirement: Paragraphs inside the block
WHILE the cursor is inside a writing block in Live Preview, Enter SHALL start a new paragraph in the block, and Enter on an empty last line after at least one paragraph SHALL leave the block, removing that empty line. Pasted lines SHALL stay inside the block. Backspace at the start of a paragraph SHALL join it to the one before, and on the block's only empty line SHALL remove the block. However two paragraphs are joined, no `>` SHALL be left in the writing.

#### Scenario: Enter stays in the block
- **GIVEN** the cursor at the end of a paragraph in a writing block
- **WHEN** the writer presses Enter and types
- **THEN** the new text is a new paragraph inside the block, saved as a `> ` line

Test: tests/writingblocks.test.ts › "enter starts a new paragraph in the block" [the keymap is checked by hand]

#### Scenario: Enter twice leaves the block
- **GIVEN** the cursor at the end of the block's last paragraph
- **WHEN** the writer presses Enter twice
- **THEN** the cursor is on a new line below the block, and the block ends with that paragraph

Test: tests/writingblocks.test.ts › "enter on an empty last line leaves the block" [the keymap is checked by hand]

#### Scenario: Backspace joins paragraphs
- **GIVEN** the cursor at the start of the block's second paragraph
- **WHEN** the writer presses Backspace
- **THEN** the two paragraphs become one

Test: tests/writingblocks.test.ts › "backspace at a paragraph's start joins it to the one before" [the keymap is checked by hand]

#### Scenario: Joining never leaves a >
- **GIVEN** two paragraphs in a block
- **WHEN** the writer joins them by any route: a selection deleted across the line break, or Delete at the end of the first
- **THEN** the joined paragraph contains no `>`

Test: tests/writingblocks.test.ts › "a join takes the next line's > with the line break" [the editor's handling is checked by hand]

### Requirement: Draft mode before review
WHILE a writing block has never been reviewed, Inkwell SHALL show it in Draft mode: just the writing, which the writer edits normally. Nothing besides the block itself is written to the note.

#### Scenario: A new block is in Draft mode
- **WHEN** the writer creates a writing block and types in it
- **THEN** the block is in Draft mode, and the note holds only the callout

Test: tests/writingblocks.test.ts › "a block with no comment is in Draft mode"

### Requirement: Entering review keeps the first draft
WHEN a writing block first leaves Draft mode (to Review or Edited), Inkwell SHALL save its current text as the first draft, in an Obsidian comment one blank line below the block, opening with `%% writing-block first-draft <mode>` and closing with `%%`. Later mode changes SHALL NOT change the first draft.

#### Scenario: First review saves the first draft
- **GIVEN** a block in Draft mode with the text "I have been here before."
- **WHEN** the writer switches it to Review
- **THEN** a comment directly below the block holds "I have been here before." and the mode `review`
- **AND** the block's own text is unchanged

Test: tests/writingblocks.test.ts › "first review saves the text as the first draft below the block"

#### Scenario: Going straight to Edited also keeps the first draft
- **GIVEN** a block in Draft mode that was never reviewed
- **WHEN** the writer switches it to Edited
- **THEN** a comment below the block holds its text and the mode `edited`

Test: tests/writingblocks.test.ts › "going straight to Edited also keeps the first draft"

#### Scenario: The first draft never moves
- **GIVEN** a reviewed block whose text has since been revised
- **WHEN** the writer switches between Draft, Review and Edited several times
- **THEN** the first draft in the comment is exactly what it was when review began

Test: tests/writingblocks.test.ts › "the first draft never changes across mode switches"

### Requirement: The first draft is protected
IF an edit in Live Preview would change a block's kept first draft, or the blank line above it, while the cursor is not in the first draft, THEN Inkwell SHALL refuse the edit and show a notice. Deleting the whole block with its first draft SHALL be allowed, and so SHALL editing the first draft by hand with the cursor in it.

#### Scenario: Backspace below the first draft
- **GIVEN** a reviewed block, and the cursor at the start of the line below its folded first draft
- **WHEN** the writer presses Backspace
- **THEN** the note is unchanged and a notice explains why

Test: tests/writingblocks.test.ts › "the kept first draft can't be edited by accident" [the refusal and notice are checked by hand]

#### Scenario: Leaving the block keeps it apart
- **GIVEN** the cursor on the block's empty last line
- **WHEN** the writer presses Enter and types
- **THEN** a blank line separates the new text from the block, so it is not part of it

Test: tests/writingblocks.test.ts › "enter on an empty last line leaves the block"

### Requirement: Review mode
WHILE a block is in Review, Inkwell SHALL show its current text with words added since the first draft highlighted and words removed since the first draft struck through, updating as the writer types. The writer SHALL be able to edit the text in Review.

#### Scenario: Changes show while revising
- **GIVEN** a block whose first draft is "I have been here before."
- **WHEN** in Review the writer changes "been here" to "come back"
- **THEN** "been here" shows struck through and "come back" shows highlighted

Test: none yet [the diff is unit-tested; the drawing is checked by hand]

#### Scenario: No changes yet
- **GIVEN** a block that has just entered Review
- **WHEN** the writer views it
- **THEN** the text shows with no marks

Test: none yet

#### Scenario: Paragraph breaks count as changes
- **WHEN** in Review the writer splits one paragraph into two
- **THEN** the new break shows as a change

Test: none yet

### Requirement: Edited mode
WHILE a block is in Edited mode, Inkwell SHALL show its current text clean, with no marks. The writer SHALL be able to edit the text in Edited mode.

#### Scenario: Reading the revision
- **GIVEN** a reviewed block with changes
- **WHEN** the writer switches it to Edited
- **THEN** the current text shows with no highlights or strike-throughs

Test: none yet

### Requirement: Draft mode after review
WHILE a reviewed block is in Draft mode, Inkwell SHALL show the first draft in place of the current text, read-only. IF the writer tries to type in it, THEN Inkwell SHALL leave the note unchanged and show a notice to switch to Review or Edited to revise.

#### Scenario: Looking back at the first draft
- **GIVEN** a reviewed block whose text has been revised
- **WHEN** the writer switches it to Draft
- **THEN** the first draft shows, and typing in it changes nothing and shows the notice

Test: none yet

### Requirement: Block toolbar
Inkwell SHALL show a toolbar across the top of every writing block, in reading view and in Live Preview whether or not the cursor is inside the block. For a writing block it SHALL show the three modes, Draft, Review and Edited, with the current one marked, and the writer SHALL be able to pick any of them at any time.

#### Scenario: The toolbar is always there
- **GIVEN** a writing block in Live Preview
- **WHEN** the writer looks at it with the cursor elsewhere, then clicks into it and types
- **THEN** the toolbar shows above the writing both times, with the current mode marked

Test: none yet [checked by hand in test-vault]

#### Scenario: Any mode, any order
- **GIVEN** a block in Edited mode
- **WHEN** the writer picks Draft on the toolbar, then Review
- **THEN** the block switches to each in turn

Test: tests/writingblocks.test.ts › "picking modes in any order" [the toolbar itself is checked by hand]

### Requirement: Switching modes
WHEN the writer picks a mode on a block's toolbar or runs "Draft mode", "Review mode" or "Edited mode" with the cursor in a block, Inkwell SHALL change only the mode word in the block's comment. The writing SHALL be unchanged, the mode SHALL be kept in the note so it shows the same after reloading or on another device, and undo SHALL reverse the switch.

#### Scenario: Switching changes only the mode word
- **GIVEN** a reviewed block in Review
- **WHEN** the writer switches it to Edited
- **THEN** the comment's opening line reads `%% writing-block first-draft edited`, and nothing else in the note changes

Test: tests/writingblocks.test.ts › "switching modes changes only the mode word"

#### Scenario: Each block keeps its own mode
- **GIVEN** two reviewed blocks in one note
- **WHEN** the writer switches the first to Edited
- **THEN** the second keeps its mode

Test: tests/writingblocks.test.ts › "each block keeps its own mode"

### Requirement: Comment marks in the writing
IF the writing contains `%%`, THEN Inkwell SHALL refuse to enter Review and show a notice, leaving the note unchanged.

#### Scenario: Writing that would end the comment early
- **GIVEN** a block whose text contains `%%`
- **WHEN** the writer switches it to Review
- **THEN** a notice explains why, and the note is unchanged

Test: tests/writingblocks.test.ts › "refuses review when the writing contains %%" [the notice is checked by hand]

### Requirement: Missing or damaged first draft
IF a block's comment is missing, or its opening line can't be read, THEN Inkwell SHALL treat the block as never reviewed, and SHALL NOT change or remove the comment.

#### Scenario: Comment deleted by hand
- **GIVEN** a reviewed block whose comment the writer deleted
- **WHEN** the writer views the block
- **THEN** it is in Draft mode, showing its current text

Test: tests/writingblocks.test.ts › "a missing or unreadable comment means never reviewed"

### Requirement: Keep the Rhythm comment setting
WHERE Keep the Rhythm is installed and its "Don't count comments" setting is off, WHEN a block enters Review for the first time, Inkwell SHALL show a notice that the first draft will be counted as new words unless that setting is turned on. Inkwell SHALL NOT change Keep the Rhythm's settings.

#### Scenario: Setting off
- **GIVEN** Keep the Rhythm with "Don't count comments" off
- **WHEN** a block enters Review for the first time
- **THEN** the notice appears, and review continues

Test: tests/keep-the-rhythm.test.ts › "reads whether comments are ignored, or null when unavailable" [the notice is checked by hand]

#### Scenario: Setting on, or Keep the Rhythm absent
- **GIVEN** Keep the Rhythm with "Don't count comments" on, or not installed
- **WHEN** a block enters Review for the first time
- **THEN** no notice appears

Test: tests/keep-the-rhythm.test.ts › "reads whether comments are ignored, or null when unavailable" [the notice is checked by hand]

### Requirement: Word counts
Inkwell's word counts SHALL count a writing block's current text only: neither the `[!writing]` header line nor the first draft.

#### Scenario: Counting a reviewed block
- **GIVEN** a reviewed block with a 5-word title, 10 words of current text and a 12-word first draft
- **WHEN** Inkwell counts the note's words
- **THEN** the block adds 10

Test: tests/wordcount.test.ts › "counts only a block's current text"

### Requirement: Moving work up
WHEN the writer runs "This became a story" on an exercise, or "Promote story to long form" on a story, Inkwell SHALL carry each writing block forward as its current text, as plain paragraphs, without the callout or the first draft. Breaks and headings inside the first draft SHALL NOT split scenes.

#### Scenario: A story starts from the revised text
- **GIVEN** an exercise whose Work section has a reviewed block
- **WHEN** the writer runs "This became a story"
- **THEN** the new draft holds the block's current text as plain paragraphs
- **AND** the exercise is unchanged except for `became`

Test: none yet

#### Scenario: Promoting keeps the first draft out of scenes
- **GIVEN** a story draft with a reviewed block whose first draft contains `***`
- **WHEN** the writer promotes the story
- **THEN** the scenes hold only current text, split at breaks in the current text only
- **AND** the original draft, with the block and its comment, is kept in the project's `Archive/`

Test: none yet

### Requirement: Exercise template
Inkwell's built-in exercise template SHALL start its `## Work` section with an empty writing block. Template files the writer already has SHALL NOT be changed.

#### Scenario: New exercise has a block
- **GIVEN** no custom exercise template
- **WHEN** the writer creates an exercise
- **THEN** its Work section holds an empty writing block

Test: none yet
