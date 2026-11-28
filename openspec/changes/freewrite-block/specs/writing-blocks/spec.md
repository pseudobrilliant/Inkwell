# Spec Delta

## MODIFIED Requirements

### Requirement: Block toolbar
Inkwell SHALL show a toolbar across the top of every writing block, in reading view and in Live Preview whether or not the cursor is inside the block. For a writing block it SHALL show the three modes, Draft, Review and Edited, with the current one marked, and the writer SHALL be able to pick any of them at any time. For a free-write block it SHALL show the label "Free-write" in their place, which does nothing when tapped. The host's tools SHALL follow, at the far right, for every type.

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

#### Scenario: A free-write block's toolbar
- **GIVEN** a free-write block
- **WHEN** the writer looks at its toolbar
- **THEN** it shows "Free-write" and the word count, and no Draft, Review or Edited

Test: tests/writingblocks.test.ts › "a free-write block has no modes" [the toolbar's drawing is checked by hand]

## ADDED Requirements

### Requirement: Block type
Inkwell SHALL read a writing block's type from the callout's metadata (`> [!writing|freewrite]`), trimmed and lowercased. A block with no metadata, or a type Inkwell doesn't know, SHALL be a plain writing block, with its modes.

#### Scenario: The type is in the metadata
- **GIVEN** a note with `> [!writing|Freewrite]`, `> [!writing]` and `> [!writing|sonnet]` blocks
- **WHEN** Inkwell reads the note
- **THEN** the first is a free-write block and the other two are writing blocks

Test: tests/writingblocks.test.ts › "the block's type comes from the callout's metadata"

### Requirement: Free-write block
WHILE a block is a free-write block, Inkwell SHALL show it as Draft mode always: just the writing, edited normally, with no review and no first draft. Every editing behaviour of a writing block (typing, paragraphs, line breaks, leaving the block, its word count) SHALL apply to it unchanged.

#### Scenario: Writing in a free-write block
- **GIVEN** a free-write block in Live Preview
- **WHEN** the writer types two paragraphs, pressing Enter between them
- **THEN** both are paragraphs inside the block, and the note holds only the callout

Test: tests/writingblocks.test.ts › "a free-write block is always drafting and keeps no first draft"

### Requirement: No review for a free-write block
IF the writer tries to switch a free-write block's mode (by command, or in source mode), THEN Inkwell SHALL leave the note unchanged. The "Draft mode", "Review mode" and "Edited mode" commands and menu items SHALL NOT be offered with the cursor in a free-write block. IF a first-draft comment follows a free-write block, THEN Inkwell SHALL ignore it, leaving it in the note as an ordinary comment.

#### Scenario: Review isn't offered
- **GIVEN** the cursor in a free-write block
- **WHEN** the writer opens the command palette or the editor menu
- **THEN** "Review mode" isn't there

Test: tests/writingblocks.test.ts › "switching a free-write block's mode changes nothing" [the commands and menu are checked by hand]

#### Scenario: A writing block changed to free-write by hand
- **GIVEN** a reviewed writing block with its first-draft comment, whose header the writer edits to `> [!writing|freewrite]`
- **WHEN** Inkwell reads the note
- **THEN** the block is a free-write block in Draft, showing its current text, and the comment is left as it is

Test: tests/writingblocks.test.ts › "a first-draft comment after a free-write block is ignored"

### Requirement: New free-write block
WHEN the writer runs "New free-write block", from the command palette or the editor menu, Inkwell SHALL do what "New writing block" does, with the header `> [!writing|freewrite]`.

#### Scenario: Empty free-write block at the cursor
- **WHEN** the writer runs "New free-write block" with nothing selected
- **THEN** `> [!writing|freewrite]` and one empty block line are inserted at the cursor, with the cursor on the empty line

Test: tests/writingblocks.test.ts › "inserts an empty free-write block" [the command is checked by hand]

#### Scenario: Wrapping a selection as free-write
- **GIVEN** two selected paragraphs
- **WHEN** the writer runs "New free-write block"
- **THEN** they become one free-write block with the same words and both paragraphs

Test: tests/writingblocks.test.ts › "wraps a selection as a free-write block" [the command is checked by hand]
