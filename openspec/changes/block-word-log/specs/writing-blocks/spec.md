# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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

Test: tests/blocks.test.ts › "today's journal holds an empty writing block and no ktr-entries block"

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

## REMOVED Requirements

### Requirement: Keep the Rhythm comment setting
**Reason**: Inkwell no longer uses Keep the Rhythm ([ADR 0007](../../../../decisions/0007-inkwell-keeps-its-own-word-log.md)). Its own word log never counts the first draft, so there's nothing to warn about.
**Migration**: None. Nothing has been released.
