# Inkwell constitution

This is what Inkwell stands for and how it is designed. Specs, ADRs, proposals, CLAUDE.md and the code all answer to it. It changes only on purpose (see **Changing the constitution**).

## What Inkwell is

Inkwell is a **writing-practice toolkit** for Obsidian. It makes a continuous writing practice effortless: capturing ideas, practising, and writing short and long pieces, with every step easy to take and the progress easy to see. Work grows from a ten-minute exercise, to a short story, to a novel. Inkwell is **not** a publishing tool.

## Core themes

Most writing software is built around the *end* of writing: compiling, formatting, exporting, submitting. Very little of it helps with the part that actually makes a writer: **writing regularly, catching ideas before they're lost, and letting small pieces grow into bigger ones.** Inkwell is built on five beliefs:

1. **Practice is the work.** Daily writing, prompts, and exercises are the foundation. A finished manuscript is only one possible result.
2. **Ideas are cheap to lose and expensive to recover.** Capturing has to be instant and must never get in the way of writing.
3. **Feed the well.** Writers are made by what they take in as much as what they put out. The poem a teacher mentions or the craft book a friend recommends is raw material too, and it's as easy to lose as an idea.
4. **Write, reflect, write again.** Revising is part of practice, not a separate stage. A writer should be able to see what they changed and read the result, without losing what they first wrote.
5. **Seeing your contribution keeps you going.** A writer who can see that they showed up today, that a story moved forward this week, and that a year of practice has added up will keep writing. Progress should be visible at every level, from a single day to a whole writing life.

## Design principles

How Inkwell makes that practice effortless.

1. **The writing block is the heart of the writing experience.** Writing happens in a dedicated callout block. Its job is to make it effortless to focus on the writing and on what that block is for. The plain experience of writing in it (typing, paragraphs, pasting, moving in and out, on desktop and phone) comes before any feature on it.
2. **Tools live on the block.** Revising and reviewing, timing, a stopwatch, word counts, grammar checks and analysis are tools on the block's toolbar. Each tool does one targeted job and connects the block to the rest of Inkwell. A tool never gets in the way of writing.
3. **Block types grow with the work.** Inkwell offers different types of block for different purposes, as writing moves from a practice prompt to a story draft to a novel's scene. Every type is the same base block with its own choice of tools. Types are added when they're needed, not designed up front.
4. **Inkwell counts the writing itself.** Blocks are how Inkwell counts and analyses writing. Inkwell keeps its own word log, so the numbers are the same on every device and don't depend on another plugin ([ADR 0007](decisions/0007-inkwell-keeps-its-own-word-log.md)).
5. **Goals for the day and week are core.** Daily and weekly word-count goals, built on that count, show a writer whether they're keeping up the practice. They sit alongside the totals for a piece and for a writing life.
6. **Home is where progress is seen.** The Home dashboard is Inkwell's main view: today's and this week's counts and goals, analysis, totals, and what's in progress. Every number Inkwell keeps shows up there.

## Tenets

Rules every feature keeps.

- **Plain notes, always.** Everything is ordinary Markdown with frontmatter. Uninstalling Inkwell loses nothing, and that includes the word log, which stays readable.
- **Write first, organize later.** Capture is instant. Filing is optional and can be batched.
- **Each mode is as light as its purpose.** Practice is quick, short form is one draft, and long form gets the full structure. Don't add weight to a lighter mode.
- **Build what's core, integrate the rest.** Writing, counting and goals are core, so Inkwell owns them. For the rest, use what exists: Bases for tables, StoryLine for advanced long-form views.
- **Mobile from day one.** No desktop-only APIs.
- **Not a publishing tool.** No compile, export, or submission tracking.
- **Prose only.** TTRPG and worldbuilding projects are out of scope.
- **Safe by default.** Anything that moves, splits, or rewrites notes saves the original to `Archive/` or uses Obsidian's trash first.

## Changing the constitution

- Change it on purpose, in its own commit, and say why in the commit message.
- A change that reverses a decision also needs an ADR in `decisions/`.
- Specs, CLAUDE.md, `config.yaml` and the README follow the constitution, never the other way round. When it changes, bring them into line in the same commit, or note what's still to follow.
