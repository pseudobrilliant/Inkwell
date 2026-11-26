# Writing block types

- **Status:** open (after the writing-blocks change)
- **Likely capabilities:** writing-blocks
- **ADRs:** ADR 0006 (block format). The type goes in the callout's metadata, `[!writing|<type>]`.

## Why

Writing blocks are a core component that supports features across Inkwell. Different kinds of writing want different tools on the block, so new block types are made as they're needed, not designed up front from a list of exercises.

## The shape (settled with the writer, 2026-11-26)

- **The block is the base.** The box, and writing in it, is the main functionality. The writing experience inside it (typing, paragraphs, pasting, moving in and out, on desktop and phone) is the base every type shares, and it comes first.
- **Everything else is a tool on the block.** Draft → Revise → View (today's Draft, Review and Edited modes) is a tool, like the timer will be, not the block itself. A type is the base block plus a choice of tools.
- **Tools combine.** One block can carry several tools. The most used type will be the writing block with the revision and timer tools; others are made later, one at a time, as they're needed.

## What could change

- Turn today's modes into the first tool: its own state, toolbar controls, and what it draws. A block without it is just the box.
- A type definition: which tools it carries, and options such as the look (indent, font).
- Where per-block state lives when a tool has no comment of its own yet (the `[!writing|type …]` header is the likely place).

## Open questions

- Labels: Draft → Revise → View, or keep Draft, Review, Edited? Today "Draft" means two things: where you write before review, and the locked first draft after it.
- In what order do combined tools show in the toolbar?

## Out of scope / constraints

Each type stays as light as its purpose, and every type is plain Markdown that reads without Inkwell. Prose only: no TTRPG or worldbuilding types.
