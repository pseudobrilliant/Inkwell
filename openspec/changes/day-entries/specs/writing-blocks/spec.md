## MODIFIED Requirements

### Requirement: Drafts, scenes and journals start with a block
Inkwell's built-in story draft and journal templates SHALL hold an empty writing block, and a new scene SHALL start with one. In a journal the block SHALL sit under "Journal Notes", and the journal SHALL end with a "Words Written today" section holding an `inkwell-entries` block. Template files the writer already has, and notes that already exist, SHALL NOT be changed.

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
- **THEN** its sections are "Daily Goals", "Ideas, Observations, Reflections", "Journal Notes" holding an empty writing block, an empty "Writing", and "Words Written today" holding an `inkwell-entries` block
- **AND** it holds no `ktr-entries` block

Test: tests/blocks.test.ts › "today's journal holds an empty writing block and no ktr-entries block"
