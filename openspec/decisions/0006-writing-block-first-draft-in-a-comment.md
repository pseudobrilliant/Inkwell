# 0006. Writing blocks are callouts, with the first draft in a comment

- **Status:** accepted
- **Date:** 2026-11-25
- **Specs:** writing-blocks

## Context

Writing blocks let the writer revise and see what changed since the first draft (Draft, Review, Edited). That means keeping two versions of the same text. Once notes hold blocks, their format is hard to change. Keep the Rhythm (ADR 0002) counts a note's whole raw text on every edit, so wherever the old version lives, it can distort word counts. Writers type on phones, where keyboards and dictation fight editors that rewrite keystrokes.

## Decision drivers

- Plain notes: everything readable without Inkwell, and uninstalling loses nothing.
- One note per piece of writing: the writer explicitly ruled out extra files.
- Keep the Rhythm's daily words must reflect what was actually written.
- Mobile from day one: no keystroke interception.
- Room for later features on the same block (types of block, a timer inside blocks).

## Considered options

1. **Inline tracked changes** (CriticMarkup `{++ ++}`/`{-- --}`), written as the writer types. Deleted words stay in the text, so KTR counts them. It also has to intercept every keystroke, which breaks phone keyboards.
2. **First draft in a separate note** per block, in a history folder. KTR is untouched, but the writer ruled out multiple notes, and the pair can drift apart on rename or copy.
3. **Depend on the Simple Track Changes plugin** (deletions in `%%~~ ~~%%`). Little Inkwell code, but it was about a week old with no users, for a feature central to Inkwell's write, reflect, write again loop.
4. **A `[!writing]` callout holding the current text, with the first draft and mode in a `%% … %%` comment below it.** Inkwell draws the changes from the two versions.

## Decision

We chose **option 4**:
- The note holds only the current text as visible prose.
- With KTR's "Don't count comments" on, the first draft and mode changes add no words, and revising counts as normal net words.
- Obsidian hides comments in reading view, and nothing intercepts typing.
- The callout's metadata leaves room for block types.

## Consequences

- Good: one plain note, nothing to accept or reject, honest word counts, and normal typing on phones.
- Bad: KTR accuracy depends on a setting the writer must turn on. Inkwell warns but never changes it.
- Bad: the writing can't contain `%%`, and a first draft damaged by hand edits is ignored.
- Format details settled while building:
  - A line break inside a paragraph (Shift+Enter) is a Markdown hard break, a `\` at the end of the line, hidden while editing.
  - Lines without `>` that Markdown joins to the callout are part of the block, as Obsidian shows them.
  - The stored mode word for Draft is `writing`, so a label never changes the format.
- Follow-up: on each KTR version check (ktr-check), confirm "Don't count comments" still exists and still strips `%% … %%`. Revisit if KTR adds a way to exclude text without a user setting.
