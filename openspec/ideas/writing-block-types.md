# Writing block types

- **Status:** open (after the writing-blocks change)
- **Likely capabilities:** writing-blocks
- **ADRs:** ADR 0006 (block format). The type goes in the callout's metadata, `[!writing|<type>]`.

## Why

Writing blocks are a core component that supports features across Inkwell, and different kinds of practice need different tools. The first type (Draft, Review, Edited, then the timer) is one way to work. A freewrite or a dialogue drill might want others.

## What could change

New block types, each a definition of its own modes and toolbar tools, sharing the box, the toolbar and the editing behaviour. The writing-blocks change builds the toolbar to take these definitions.

## Out of scope / constraints

Each type stays as light as its purpose, and every type is plain Markdown that reads without Inkwell. Prose only: no TTRPG or worldbuilding types.
