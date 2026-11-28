# writing-blocks Specification

## Purpose

A writing block marks the writing in a note, apart from the prompt, goal and notes around it, so Inkwell can help with it. Every block is a free-write block unless its header says otherwise: just the box to write in. A revision block (`[!writing|revision]`) adds review: write, see what changed while revising, then read the result, with the first draft kept in the same note. Any block can be timed (`timer` in its header).

Decisions behind this spec: [ADR 0002](../../decisions/0002-rely-on-keep-the-rhythm-for-word-logs.md), [ADR 0006](../../decisions/0006-writing-block-first-draft-in-a-comment.md).

## Requirements

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
WHILE the cursor is inside a writing block in Live Preview, Enter SHALL start a new paragraph in the block, also on an empty last line, so the writer is never taken out of the block while writing. Pasted lines SHALL stay inside the block. Backspace at the start of a paragraph SHALL join it to the one before, and on the block's only empty line SHALL remove the block, leaving an empty line in its place. However two paragraphs are joined, no `>` SHALL be left inside the writing.

#### Scenario: Enter stays in the block
- **GIVEN** the cursor at the end of a paragraph in a writing block
- **WHEN** the writer presses Enter and types
- **THEN** the new text is a new paragraph inside the block, saved as a `> ` line

Test: tests/writingblocks.test.ts › "enter starts a new paragraph in the block" [the keymap is checked by hand]

#### Scenario: Enter twice stays in the block
- **GIVEN** the cursor at the end of the block's last paragraph
- **WHEN** the writer presses Enter twice and types
- **THEN** the new text is a paragraph inside the block, after an empty one

Test: tests/writingblocks.test.ts › "enter on an empty last line starts another paragraph" [the keymap is checked by hand]

#### Scenario: Backspace in an empty block
- **GIVEN** an empty block directly below a heading, with the cursor in it
- **WHEN** the writer presses Backspace
- **THEN** the block is removed and the cursor is on an empty line below the heading, not in it

Test: tests/writingblocks.test.ts › "backspace on the only empty line removes the block"

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

### Requirement: Leaving the block
WHILE the cursor is on a writing block's last line in Live Preview, the down arrow SHALL move below the block. IF nothing follows the block in the note, THEN the down arrow SHALL add a blank line and a line to write on below it.

#### Scenario: Down arrow at the end of the note
- **GIVEN** a block that ends the note, with the cursor on its last line
- **WHEN** the writer presses the down arrow
- **THEN** a blank line and a new line are added below the block, with the cursor on the new line

Test: tests/writingblocks.test.ts › "down arrow on the last line of a note leaves the block" [the keymap is checked by hand]

### Requirement: Every line keeps its >
WHEN an edit in Live Preview removes the `>` at the start of a line of writing (a paragraph selected from its start and deleted or typed over, or a deletion back to the line's start), Inkwell SHALL put the `>` back in front of what is left on that line, unless the edit removes whole lines only.

#### Scenario: Deleting a whole paragraph
- **GIVEN** a paragraph selected from its start through its line break, as a triple-click selects it
- **WHEN** the writer deletes it, or types over it
- **THEN** the paragraph after it keeps its `>`, and stays in the block

Test: tests/writingblocks.test.ts › "deleting or typing over a whole paragraph keeps the next one's >"

#### Scenario: Deleting to a paragraph's start
- **GIVEN** the cursor in the middle of a paragraph
- **WHEN** the writer deletes back to the start of the line (Cmd+Backspace)
- **THEN** the rest of the paragraph keeps its `>`

Test: tests/writingblocks.test.ts › "deleting to a paragraph's start keeps its >"

### Requirement: The cursor stays off the hidden header
WHILE a writing block shows in Live Preview, the cursor SHALL NOT rest on its hidden header. Arriving from above or by a click, it SHALL go into the writing. Leaving the first paragraph by Left or Up, it SHALL go to the line above the block. Arriving by Up from below, it SHALL go to the block's last paragraph.

#### Scenario: Left from the first paragraph
- **GIVEN** the cursor at the start of the block's first paragraph
- **WHEN** the writer presses Left, then types
- **THEN** the cursor is at the end of the line above the block, the typing goes there, and the block is unchanged

Test: tests/writingblocks.test.ts › "the cursor never rests on the hidden header" [the editor's handling is checked by hand]

### Requirement: Edits that break the header
IF an edit in Live Preview would break a block's header (typing before it, joining it onto the line above, or joining the writing onto it), THEN Inkwell SHALL refuse the edit and show a notice. Deleting the whole block, or whole lines above it, SHALL be allowed.

#### Scenario: Delete at the end of the heading above
- **GIVEN** a block directly below the heading "Work"
- **WHEN** the writer presses Delete at the end of the heading
- **THEN** the note is unchanged and a notice explains why

Test: tests/writingblocks.test.ts › "edits that would break the header are refused" [the notice is checked by hand]

### Requirement: Typing below a block
WHEN the writer types on the blank line straight below a block that has no first draft, Inkwell SHALL start the text one line further down, so a blank line keeps it out of the block.

#### Scenario: Typing below a block
- **GIVEN** a block followed by a blank line and a heading
- **WHEN** the writer types on the blank line
- **THEN** the text is on its own line, with a blank line between it and the block, and is not part of the block

Test: tests/writingblocks.test.ts › "typing straight below a block keeps a blank line between"

### Requirement: Draft mode before review
WHILE a writing block has never been reviewed, Inkwell SHALL show it in Draft mode: just the writing, which the writer edits normally. Nothing besides the block itself is written to the note.

#### Scenario: A new block is in Draft mode
- **WHEN** the writer creates a writing block and types in it
- **THEN** the block is in Draft mode, and the note holds only the callout

Test: tests/writingblocks.test.ts › "a block with no comment is in Draft mode"

### Requirement: Line breaks inside a paragraph
WHILE the cursor is inside a writing block in Live Preview, Shift+Enter SHALL start a new line in the same paragraph, saved as a Markdown hard line break: a `\` at the end of the line before it. The new line SHALL have no first-line indent, while editing and when rendered, and the `\` SHALL be hidden while editing. Joining the two lines SHALL remove the `\`.

#### Scenario: Shift+Enter continues the paragraph
- **GIVEN** the cursor after "The door was open, and" in a writing block
- **WHEN** the writer presses Shift+Enter and types "I walked in."
- **THEN** the note holds `> The door was open, and\` and `> I walked in.`, and "I walked in." shows on its own line, not indented

Test: tests/writingblocks.test.ts › "shift+enter breaks the line and saves a \\ at its end" [the drawing is checked by hand]

#### Scenario: Backspace undoes the line break
- **GIVEN** the cursor at the start of a Shift+Enter line
- **WHEN** the writer presses Backspace
- **THEN** the two lines become one, with no `\` left in the writing

Test: tests/writingblocks.test.ts › "joining a line break removes its \\"

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
IF an edit in Live Preview would change a block's kept first draft, or the blank line above it, while the cursor is not inside the first draft, THEN Inkwell SHALL refuse the edit and show a notice. The folded first draft SHALL open only when the writer clicks it: moving the cursor SHALL pass over it and the blank line above it, never resting at its edges. Deleting the whole block with its first draft SHALL be allowed, and so SHALL editing the first draft by hand once opened.

#### Scenario: Backspace below the first draft
- **GIVEN** a reviewed block, and the cursor at the start of the line below its folded first draft
- **WHEN** the writer presses Backspace
- **THEN** the note is unchanged and a notice explains why

Test: tests/writingblocks.test.ts › "the kept first draft can't be edited by accident" [the refusal and notice are checked by hand]

#### Scenario: Moving past the first draft
- **GIVEN** a reviewed block, and the cursor on its last line
- **WHEN** the writer presses the down arrow, then types
- **THEN** the cursor is on the line below the folded first draft, the draft stays folded, and the typing goes there

Test: tests/writingblocks.test.ts › "the folded first draft is passed over, never opened by moving" [the fold is checked by hand]

#### Scenario: Typing at the draft's edge
- **GIVEN** the cursor at the very end of the folded first draft (the note ends there)
- **WHEN** the writer types a letter
- **THEN** the note is unchanged and a notice explains why, but Enter adds a line below

Test: tests/writingblocks.test.ts › "typing at the edges of a first draft is refused"

### Requirement: Review mode
WHILE a block is in Review, Inkwell SHALL show its current text with words added since the first draft highlighted and words removed since the first draft struck through, updating as the writer types. The writer SHALL be able to edit the text in Review.

#### Scenario: Changes show while revising
- **GIVEN** a block whose first draft is "I have been here before."
- **WHEN** in Review the writer changes "been here" to "come back"
- **THEN** "been here" shows struck through and "come back" shows highlighted

Test: tests/writingblocks.test.ts › "diff marks replaced words as removed then added" [the drawing is checked by hand]

#### Scenario: No changes yet
- **GIVEN** a block that has just entered Review
- **WHEN** the writer views it
- **THEN** the text shows with no marks

Test: tests/writingblocks.test.ts › "no changes gives no marks"

#### Scenario: Paragraph breaks aren't marked
- **WHEN** in Review the writer splits one paragraph into two, or joins two
- **THEN** the block shows the new paragraphs with no mark for the break, and words added or removed around it are still marked

Test: tests/writingblocks.test.ts › "paragraph breaks change the layout without a mark"

### Requirement: Edited mode
WHILE a block is in Edited mode, Inkwell SHALL show its current text clean, with no marks. The writer SHALL be able to edit the text in Edited mode.

#### Scenario: Reading the revision
- **GIVEN** a reviewed block with changes
- **WHEN** the writer switches it to Edited
- **THEN** the current text shows with no highlights or strike-throughs

Test: tests/writingblocks.test.ts › "edited shows current text with no marks" [the drawing is checked by hand]

### Requirement: Draft mode after review
WHILE a reviewed block is in Draft mode, Inkwell SHALL show the first draft in place of the current text, read-only. IF the writer tries to type in it, THEN Inkwell SHALL leave the note unchanged and show a notice to switch to Review or Edited to revise.

#### Scenario: Looking back at the first draft
- **GIVEN** a reviewed block whose text has been revised
- **WHEN** the writer switches it to Draft
- **THEN** the first draft shows, and typing in it changes nothing and shows the notice

Test: tests/writingblocks.test.ts › "typing into a reviewed block in Draft mode is refused" [the notice is checked by hand]

#### Scenario: The end of a locked block
- **GIVEN** a reviewed block in Draft mode
- **WHEN** the cursor arrives at the very end of its first draft and the writer types
- **THEN** the cursor moves past the block, and typing there is refused, except a line break when the note ends there

Test: tests/writingblocks.test.ts › "the end of a locked block is locked too"

Test: tests/writingblocks.test.ts › "typing into a reviewed block in Draft mode is refused" [the notice and the drawing are checked by hand]

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
IF a block's comment is missing, its opening line can't be read, or the first line holding `%%` after it isn't a bare `%%`, THEN Inkwell SHALL treat the block as never reviewed, SHALL NOT read past that line, and SHALL NOT change or remove the comment.

#### Scenario: Comment deleted by hand
- **GIVEN** a reviewed block whose comment the writer deleted
- **WHEN** the writer views the block
- **THEN** it is in Draft mode, showing its current text

Test: tests/writingblocks.test.ts › "a missing or unreadable comment means never reviewed"

#### Scenario: Closing line damaged by hand
- **GIVEN** two reviewed blocks, the first with "x" typed after its closing `%%`
- **WHEN** Inkwell reads the note
- **THEN** the first block is never reviewed, and the second keeps its own text and first draft

Test: tests/writingblocks.test.ts › "a damaged closing %% means never reviewed, and nothing past it is read"

### Requirement: Typewriter Mode while writing
WHERE the Typewriter Mode plugin is installed and enabled, WHEN the cursor moves into a block's writing in the focused editor in Live Preview, Inkwell SHALL turn Typewriter Mode on, and WHEN the writer stops writing in a block (the cursor leaves it, another editor takes focus, or the note closes), Inkwell SHALL turn it off. Inkwell SHALL use Typewriter Mode's own enable and disable commands, so its other settings still apply. A reviewed block locked in Draft mode is not written in.

#### Scenario: Into and out of a block
- **GIVEN** Typewriter Mode installed and enabled
- **WHEN** the writer clicks into a writing block, then clicks below it
- **THEN** Typewriter Mode turns on, then off

Test: tests/writingblocks.test.ts › "knows when the cursor is in a block's writing, and not in a locked one" [the editor and Typewriter Mode are checked by hand]

#### Scenario: Moving between blocks in two editors
- **GIVEN** a block being written in one pane
- **WHEN** the writer clicks into a block in another pane
- **THEN** Typewriter Mode stays on

Test: tests/typewriter-mode.test.ts › "turns Typewriter Mode on entering a block and off leaving it, in either order across editors"

#### Scenario: Typewriter Mode absent
- **GIVEN** Typewriter Mode not installed, or disabled
- **WHEN** the writer enters and leaves a block
- **THEN** nothing happens

Test: tests/typewriter-mode.test.ts › "does nothing when Typewriter Mode isn't installed or enabled"

### Requirement: Word counts
Inkwell's word counts SHALL count a writing block's current text only: neither the `[!writing]` header line nor the first draft.

#### Scenario: Counting a reviewed block
- **GIVEN** a reviewed block with a 5-word title, 10 words of current text and a 12-word first draft
- **WHEN** Inkwell counts the note's words
- **THEN** the block adds 10

Test: tests/wordcount.test.ts › "counts only a block's current text"

### Requirement: Moving work up
WHEN the writer runs "This became a story" on an exercise, or "Promote story to long form" on a story, Inkwell SHALL carry each writing block forward as a writing block holding its current text, without the first draft, so the writing keeps counting in its new note. Breaks and headings inside the first draft SHALL NOT split scenes.

#### Scenario: A story starts from the revised text
- **GIVEN** an exercise whose Work section has a reviewed block
- **WHEN** the writer runs "This became a story"
- **THEN** the new draft holds one writing block with the block's current text, and no first-draft comment
- **AND** the exercise is unchanged except for `became`

Test: tests/became.test.ts › "a story starts from the block's current text"

#### Scenario: Promoting keeps the first draft out of scenes
- **GIVEN** a story draft with a reviewed block whose first draft contains `***`
- **WHEN** the writer promotes the story
- **THEN** each scene holds one writing block with only current text, split at breaks in the current text only
- **AND** the original draft, with the block and its comment, is kept in the project's `Archive/`

Test: tests/promote.test.ts › "scenes hold only current text, and the original draft is archived first"

### Requirement: Exercise template
Inkwell's built-in exercise template SHALL start its `## Work` section with an empty writing block. Template files the writer already has SHALL NOT be changed.

#### Scenario: New exercise has a block
- **GIVEN** no custom exercise template
- **WHEN** the writer creates an exercise
- **THEN** its Work section holds an empty writing block

Test: tests/blocks.test.ts › "the built-in exercise template starts Work with a timed revision block and Reflection with a timed free-write block"

### Requirement: Drafts, scenes and journals start with a block
Inkwell's built-in story draft and journal templates SHALL hold an empty writing block, and a new scene SHALL start with one. In a journal it replaces the "Words written" section. Template files the writer already has, and notes that already exist, SHALL NOT be changed.

#### Scenario: A new story draft
- **GIVEN** no custom story draft template
- **WHEN** the writer creates a short story
- **THEN** its draft holds an empty writing block

Test: tests/blocks.test.ts › "a new story draft holds an empty writing block"

#### Scenario: A new scene
- **WHEN** the writer adds a scene to a project
- **THEN** the scene's body is an empty writing block

Test: tests/blocks.test.ts › "a new scene's body is an empty writing block, unless it's given one"

#### Scenario: Today's journal
- **GIVEN** no custom journal template
- **WHEN** the writer opens today's journal for the first time
- **THEN** it holds an empty writing block and no `ktr-entries` block

Test: tests/blocks.test.ts › "today's journal has a Writing list, no block and no ktr-entries block"

### Requirement: Word count on the block
Every writing block's toolbar SHALL show a word count tool with the words in what the block shows, counted as in the "Word counts" requirement, kept up to date while the writer types. Once the block has been reviewed, in Review and Edited it SHALL also show the change since the first draft, and in Draft mode, which shows the first draft, it SHALL count the first draft.

#### Scenario: Writing a block
- **GIVEN** a block that was never reviewed, holding "I have come back before." and "Again."
- **WHEN** the toolbar shows
- **THEN** the word count shows 6 words, and it goes up as the writer types

Test: tests/writingblocks.test.ts › "counts the words in a block that was never reviewed" [updating while typing is checked by hand]

#### Scenario: Revising a reviewed block
- **GIVEN** a reviewed block whose first draft has 4 words and whose writing now has 6
- **WHEN** it's in Review
- **THEN** the word count shows 6 words (+2)

Test: tests/writingblocks.test.ts › "a reviewed block shows its words and the change since the first draft"

### Requirement: Writing that won't count
WHEN the story panel shows a story whose draft has no writing block, or the project panel shows scenes without one, Inkwell SHALL say their writing isn't counted and offer "Put in a writing block", which wraps the note's body, below its frontmatter, in one block.

#### Scenario: An old draft without a block
- **GIVEN** a story draft written as plain paragraphs
- **WHEN** the story panel shows the story
- **THEN** it says the draft's writing isn't counted and offers "Put in a writing block"

Test: tests/blocks.test.ts › "a draft without a block is found, and one with a block isn't"

#### Scenario: Putting a draft in a block
- **GIVEN** a story draft of three plain paragraphs
- **WHEN** the writer chooses "Put in a writing block"
- **THEN** the draft holds one writing block with the same three paragraphs, and the frontmatter is unchanged
- **AND** the log doesn't change

Test: tests/blocks.test.ts › "putting a draft in a block keeps its paragraphs and frontmatter, and logs nothing"
