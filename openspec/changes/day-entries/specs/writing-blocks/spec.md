## MODIFIED Requirements

### Requirement: Drafts, scenes and journals start with a block
Inkwell's built-in story draft and journal templates SHALL hold an empty writing block, and a new scene SHALL start with one. The built-in journal template SHALL end with a "Words written today" section holding an `inkwell-entries` block, after the writing block. Template files the writer already has, and notes that already exist, SHALL NOT be changed.

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
- **THEN** it holds an empty writing block, then a "Words written today" section with an `inkwell-entries` block, and no `ktr-entries` block

Test: tests/blocks.test.ts › "today's journal holds an empty writing block, then the day's entries, and no ktr-entries block"
