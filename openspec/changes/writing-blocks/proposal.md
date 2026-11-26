# Proposal

## Why

Write, reflect, write again. Today a writing block is prose indented with tabs, which Markdown treats as a code block, so Inkwell can't tell the writing apart from the prompt and reflection around it, and nothing helps the writer revise it. A writing block that Inkwell recognizes gives practice a unit of its own. Review, seeing what changed between the first draft and the revised one, is the first and most important feature built on it.

Writing blocks are a core component of Inkwell, not a mode: they support features across Capture, Practice and the writing modes, starting with practice exercises. They are kept self-contained, so they could become their own plugin later, though that isn't planned.

Picked up from the `writing-blocks` idea.

## What Changes

- **Writing block:** a new kind of block, a `> [!writing]` callout, usable in any note. It has the look of today's tabbed blocks: a box, typewriter font and first-line indent. A command creates one, wrapping the selection or converting a tab-indented block.
- **A toolbar on every block**, always visible, rendered and while typing. It is the block's main control, and the place later block types and tools (the timer next) go.
- **Three modes per block**, switched from the toolbar, freely and in any order, or by command:
  - **Draft:** before review, the block is just the writing. After review, Draft shows the text as first written, read-only.
  - **Review:** shows the changes since the first draft, with added text highlighted and removed text struck through, updating as the writer revises. The writer can type here.
  - **Edited:** the revised text, clean. The writer can type here.
- **The first draft is kept in the same note**, in an Obsidian comment (`%% … %%`) directly below the block, saved the first time the block enters Review. Comments are hidden in reading view. Review always compares against this first draft.
- **Nothing to accept or reject:** changes are never written into the text as marks; Inkwell draws them from the two versions.
- **Keep the Rhythm stays accurate** when its "Don't count comments" setting is on. Inkwell shows a notice when entering review if it's off, and never changes KTR's settings.
- **Moving work up carries only the revised text:** "This became a story" and "Promote story to long form" read a writing block as its current prose, never the kept first draft.
- The built-in exercise template's `## Work` section starts with an empty writing block. Existing template files are not changed.
- Before anything new is built, tests pin today's behaviour of word counting, the exercise's Work section, and scene splitting, including headings and `***` inside comments.

## Capabilities

### New Capabilities

- `writing-blocks`: the writing block (creation, conversion, look), its modes, the kept first draft, the review view, and how blocks are read by word counts, "This became a story" and promotion.

### Modified Capabilities

None. The writing timer is unchanged. Practice, movement and KTR integration have no specs yet; their new requirements around writing blocks are written in `writing-blocks`.

## Impact

- **ADRs:** builds on ADR 0002 (KTR counts the words; Inkwell never writes KTR settings). Needs a new ADR, **0006**, for keeping the first draft in a comment in the same note: it is hard to reverse, since notes will hold blocks in that format, and it picks between real options (extra notes, inline tracked changes, a third-party plugin).
- **Code:** new `src/writingblocks.ts` (pure: parse, modes, conversion, unwrap, diff segments), `src/writingblockeditor.ts` (Live Preview), `src/writingblockview.ts` (reading view). Changes to `src/main.ts` (commands, editor menu), `src/became.ts`, `src/promote.ts`, `src/templates.ts`, `src/integrations/keep-the-rhythm.ts` (read `ignoreComments`), and `styles.css`.
- **Dependencies:** `@codemirror/merge` for the diff, bundled into `main.js` (only its diff function, checked for size), plus `@codemirror/state`, `@codemirror/view` and `@codemirror/language` as dev dependencies for types (already external in `esbuild.config.mjs`).
- **Tests:** new `tests/writingblocks.test.ts`; additions to `tests/wordcount.test.ts`, `tests/promote.test.ts` and a new `tests/became.test.ts`.
- **Out of scope:**
  - The timer in the block's toolbar, timing the first write and replacing the note-level timer in notes with a block (idea `writing-block-timer`, the next change). Types of block (idea `writing-block-types`). Per-block numbers. Each is a later change on the same block and toolbar.
  - Rounds ("Write again"). Review always compares against the first draft.
  - Comments, suggestions, authors and sharing: Inkwell is not a collaboration or publishing tool.
  - A restore command; the first draft can be copied from Draft mode.
- **Weight on a lighter mode:** none by default. Practice notes gain a block only through the built-in exercise template. Review is opt-in per block, and a block that is never reviewed is just a callout.
