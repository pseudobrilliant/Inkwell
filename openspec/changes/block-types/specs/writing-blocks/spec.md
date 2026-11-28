# Spec Delta

## MODIFIED Requirements

### Requirement: Draft mode before review
WHILE a revision block has never been reviewed, Inkwell SHALL show it in Draft mode: just the writing, which the writer edits normally. Nothing besides the block itself is written to the note.

#### Scenario: A new block is in Draft mode
- **WHEN** the writer creates a revision block and types in it
- **THEN** the block is in Draft mode, and the note holds only the callout

Test: tests/writingblocks.test.ts › "a block with no comment is in Draft mode"

### Requirement: Entering review keeps the first draft
WHEN a revision block first leaves Draft mode (to Review or Edited), Inkwell SHALL save its current text as the first draft, in an Obsidian comment one blank line below the block, opening with `%% writing-block first-draft <mode>` and closing with `%%`. Later mode changes SHALL NOT change the first draft.

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

### Requirement: Block toolbar
Inkwell SHALL show a toolbar across the top of every writing block, in reading view and in Live Preview whether or not the cursor is inside the block. For a revision block it SHALL show the three modes, Draft, Review and Edited, with the current one marked, and the writer SHALL be able to pick any of them at any time. For a free-write block it SHALL show the label "Free-write" in their place, which does nothing when tapped.

#### Scenario: The toolbar is always there
- **GIVEN** a revision block in Live Preview
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

### Requirement: Moving work up
WHEN the writer runs "This became a story" on an exercise, or "Promote story to long form" on a story, Inkwell SHALL carry each writing block forward as an untimed revision block (`> [!writing|revision]`) holding its current text, without the first draft, so the writing keeps counting in its new note. Breaks and headings inside the first draft SHALL NOT split scenes.

#### Scenario: A story starts from the revised text
- **GIVEN** an exercise whose Work section has a reviewed block
- **WHEN** the writer runs "This became a story"
- **THEN** the new draft holds one revision block with the block's current text, and no first-draft comment
- **AND** the exercise is unchanged except for `became`

Test: tests/became.test.ts › "a story starts from the block's current text"

#### Scenario: Promoting keeps the first draft out of scenes
- **GIVEN** a story draft with a reviewed block whose first draft contains `***`
- **WHEN** the writer promotes the story
- **THEN** each scene holds one writing block with only current text, split at breaks in the current text only
- **AND** the original draft, with the block and its comment, is kept in the project's `Archive/`

Test: tests/promote.test.ts › "scenes hold only current text, and the original draft is archived first"

#### Scenario: A promoted story's scenes
- **GIVEN** a short story whose draft holds a revision block
- **WHEN** the writer promotes it to long form
- **THEN** each scene's writing is in a `> [!writing|revision]` block

Test: tests/promote.test.ts › "each scene's text goes in a revision block"

### Requirement: Exercise template
Inkwell's built-in exercise template SHALL start its `## Work` section with an empty timed revision block (`> [!writing|revision timer]`), and its `## Reflection` section with an empty timed free-write block (`> [!writing|timer]`). Template files the writer already has SHALL NOT be changed.

#### Scenario: New exercise has a block
- **GIVEN** no custom exercise template
- **WHEN** the writer creates an exercise
- **THEN** its Work section holds an empty `> [!writing|revision timer]` block, and its Reflection an empty `> [!writing|timer]` block

Test: tests/blocks.test.ts › "the built-in exercise template starts Work with a timed revision block and Reflection with a timed free-write block"

### Requirement: Drafts, scenes and journals start with a block
Inkwell's built-in story draft template SHALL hold an empty untimed revision block (`> [!writing|revision]`), and a new scene SHALL start with one. The built-in journal template SHALL hold an empty free-write block (`> [!writing]`) under "Journal Notes", and the journal SHALL end with a "Words Written today" section holding an `inkwell-entries` block. Template files the writer already has, and notes that already exist, SHALL NOT be changed.

#### Scenario: A new story draft
- **GIVEN** no custom story draft template
- **WHEN** the writer creates a short story
- **THEN** its draft holds an empty `> [!writing|revision]` block

Test: tests/blocks.test.ts › "a new story draft holds an empty writing block"

#### Scenario: A new scene
- **WHEN** the writer adds a scene to a project
- **THEN** the scene's body is an empty `> [!writing|revision]` block

Test: tests/blocks.test.ts › "a new scene's body is an empty writing block, unless it's given one"

#### Scenario: Today's journal
- **GIVEN** no custom journal template
- **WHEN** the writer opens today's journal for the first time
- **THEN** its sections are "Daily Goals", "Ideas, Observations, Reflections", "Journal Notes" holding an empty free-write block, an empty "Writing", and "Words Written today" holding an `inkwell-entries` block
- **AND** it holds no `ktr-entries` block

Test: tests/blocks.test.ts › "today's journal holds an empty writing block and no ktr-entries block"

### Requirement: Writing that won't count
WHEN the story panel shows a story whose draft has no writing block, or the project panel shows scenes without one, Inkwell SHALL say their writing isn't counted and offer "Put in a writing block", which wraps the note's body, below its frontmatter, in one untimed revision block.

#### Scenario: An old draft without a block
- **GIVEN** a story draft written as plain paragraphs
- **WHEN** the story panel shows the story
- **THEN** it says the draft's writing isn't counted and offers "Put in a writing block"

Test: tests/blocks.test.ts › "a draft without a block is found, and one with a block isn't"

#### Scenario: Putting a draft in a block
- **GIVEN** a story draft of three plain paragraphs
- **WHEN** the writer chooses "Put in a writing block"
- **THEN** the draft holds one `> [!writing|revision]` block with the same three paragraphs, and the frontmatter is unchanged
- **AND** the log doesn't change

Test: tests/blocks.test.ts › "putting a draft in a block keeps its paragraphs and frontmatter, and logs nothing"

## ADDED Requirements

### Requirement: Block types and options
Inkwell SHALL read a block's type and options from the words of the callout's metadata, in any order and any case: `revision` makes it a revision block, and `timer` makes it timed. A block whose metadata names no type SHALL be a free-write block. Words Inkwell doesn't know SHALL be ignored.

#### Scenario: Types and options in the header
- **GIVEN** a note with `> [!writing]`, `> [!writing|Timer]`, `> [!writing|revision]` and `> [!writing|timer revision]` blocks
- **WHEN** Inkwell reads the note
- **THEN** they are a free-write block, a timed free-write block, a revision block and a timed revision block

Test: tests/writingblocks.test.ts › "the block's type and timer come from the callout's metadata"

#### Scenario: A word Inkwell doesn't know
- **GIVEN** a block with the header `> [!writing|sonnet]`
- **WHEN** Inkwell reads the note
- **THEN** it's an untimed free-write block

Test: tests/writingblocks.test.ts › "the block's type and timer come from the callout's metadata"

### Requirement: Reviewed blocks keep revising
IF a block's header names no type and a kept first draft follows it, THEN Inkwell SHALL treat it as a revision block, so writing reviewed before block types existed keeps its modes and first draft.

#### Scenario: An older reviewed block
- **GIVEN** a `> [!writing]` block in Review, with its first-draft comment below it
- **WHEN** Inkwell reads the note
- **THEN** it's a revision block in Review, with its first draft

Test: tests/writingblocks.test.ts › "a plain block with a kept first draft is a revision block"

### Requirement: Free-write block
WHILE a block is a free-write block, Inkwell SHALL show it as Draft always: just the writing, edited normally, with no review and no first draft. Every editing behaviour of a block (typing, paragraphs, line breaks, leaving the block, its word count) SHALL apply to it unchanged.

#### Scenario: Writing in a free-write block
- **GIVEN** a free-write block in Live Preview
- **WHEN** the writer types two paragraphs, pressing Enter between them
- **THEN** both are paragraphs inside the block, and the note holds only the callout

Test: tests/writingblocks.test.ts › "a free-write block is always drafting and keeps no first draft"

### Requirement: No review for a free-write block
IF the writer tries to switch a free-write block's mode, THEN Inkwell SHALL leave the note unchanged. The "Draft mode", "Review mode" and "Edited mode" commands and menu items SHALL NOT be offered with the cursor in a free-write block.

#### Scenario: Review isn't offered
- **GIVEN** the cursor in a free-write block
- **WHEN** the writer opens the command palette or the editor menu
- **THEN** "Review mode" isn't there

Test: tests/writingblocks.test.ts › "switching a free-write block's mode changes nothing" [the commands and menu are checked by hand]

### Requirement: New revision block
WHEN the writer runs "New revision block", from the command palette or the editor menu, Inkwell SHALL do what "New writing block" does, with the header `> [!writing|revision]`.

#### Scenario: Empty revision block at the cursor
- **WHEN** the writer runs "New revision block" with nothing selected
- **THEN** `> [!writing|revision]` and one empty block line are inserted at the cursor, with the cursor on the empty line

Test: tests/writingblocks.test.ts › "inserts an empty revision block" [the command is checked by hand]

#### Scenario: Wrapping a selection for revising
- **GIVEN** two selected paragraphs
- **WHEN** the writer runs "New revision block"
- **THEN** they become one revision block with the same words and both paragraphs

Test: tests/writingblocks.test.ts › "wraps a selection as a revision block" [the command is checked by hand]
