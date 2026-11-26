# Writing blocks

- **Status:** open
- **Likely capabilities:** writing-blocks (new), practice, writing-timer, movement, ktr-integration
- **ADRs:** ADR 0002 (KTR counts the words). Needs a new ADR for the block's format, and how it leaves room for later features. Review needs one for where earlier passes are kept.

## Why

Write, reflect, write again. Today a writing block is just prose indented with tabs, which Markdown treats as a code block. Inkwell can't tell it apart from any other text, so it can't help with the writing inside it.

A writing block that Inkwell recognizes gives practice a unit of its own, and features can build on it. Review is the first and most important of those features, but not the only one.

## What could change

**The block itself (the foundation):** a special block that can be used in any note, marking "this is the writing", apart from the prompt, goal and reflection around it. Old tabbed blocks convert to it and keep their look: typewriter font and first-line indent.

**First feature: review.** The block starts in **Writing** mode and can be switched to **Review** when the writer has finished. Review creates an **Edited** version. The writer can switch between all three modes at any time and see their changes:

- **Writing:** the text as first written.
- **Review:** the changes, with added text highlighted and removed text struck through, updating as the writer revises.
- **Edited:** the revised text, clean, for reading.

"Write again" starts another round, keeping each earlier pass.

**Later features** (each its own change, built on the same block):
- **Timer:** the writing timer runs only while typing inside a writing block, so minutes measure writing, not planning or reflection. Relates to [timer-for-drafts-and-scenes](timer-for-drafts-and-scenes.md).
- **Types of blocks:** for example freewrite, scene or letter, each with its own look or defaults.
- **Per-block numbers:** words and minutes for each block, feeding practice stats.

## Settled in discussion

From the review discussion. The proposal starts from these:
- **One note, no extra files.** The block is a `> [!writing]` callout holding the current text. Earlier passes sit in `%% … %%` comments directly below it, newest first. Comments are hidden in reading view.
- **Nothing to accept or reject.** Changes are never stored as marks: Inkwell draws them as a diff of two passes.
- **Keep the Rhythm stays accurate** with its *Don't count comments* setting on: earlier passes and mode changes add no words, and revising counts as normal net words. Inkwell never changes KTR settings.
- **Built into Inkwell**, not left to a plugin. Simple Track Changes was considered and is too new to depend on for something this central. The diff comes from `@codemirror/merge`.

## Open questions

- **Format:** how does the block name its type and keep its settings, without adding words KTR would count?
- **Review:** in which modes can the writer type? Editing the original in Writing mode would change what Review compares against.
- **Review:** does "Write again" always compare against the newest pass, or can the writer pick any pass?
- **Plugin off:** what does a block show when Inkwell is off, or when KTR's comment setting is off (notice only)?
- **Order:** is the first change the block alone, or the block with review?

## Out of scope / constraints

- Plain Markdown only: the note must stay readable, with every pass, if Inkwell is uninstalled.
- Works on mobile. No intercepting keystrokes, so phone keyboards and dictation behave normally.
- Practice stays light: features are opt-in per block. No comments, suggestions, authors or sharing: Inkwell is not a collaboration or publishing tool.
- This Became a Story and Promote carry only the current text forward.
- Before building, the tests for word counting, This Became a Story and Promote must pin their current behaviour, including `## ` and `***` inside comments.
