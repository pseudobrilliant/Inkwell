# Inkwell — CLAUDE.md

> **This document is meant to grow.** Inkwell's identity is still taking shape. When a new key concept comes up, add it to **Open questions & growing edges** first. Move it into the Modes, Progress, or Tenets sections once it's settled. Keep the README (user-facing) and this file (intent and rules) in sync when features change.

## What Inkwell is

Inkwell is a **writing-practice toolkit** for Obsidian. It helps a writer show up every day, catch every idea, and give the work that comes out of practice a place to grow: from a ten-minute exercise, to a short story, to a novel. It is **not** a publishing tool.

## Motivation & inspiration

Most writing software is built around the *end* of writing: compiling, formatting, exporting, submitting. Very little of it helps with the part that actually makes a writer: **writing regularly, catching ideas before they're lost, and letting small pieces grow into bigger ones.**

Inkwell is built on three beliefs:

1. **Practice is the work.** Daily writing, prompts, and exercises are the foundation. A finished manuscript is only one possible result.
2. **Ideas are cheap to lose and expensive to recover.** Capturing has to be instant and must never get in the way of writing.
3. **Seeing your contribution keeps you going.** A writer who can see that they showed up today, that a story moved forward this week, and that a year of practice has added up will keep writing. Progress should be visible at every level, from a single day to a whole writing life.

<!-- Author's voice: add personal motivation, inspirations, influences here as they come into focus. -->

## The shape of Inkwell: Capture + three modes

Inkwell is organized around **Capture**, which feeds everything, and **three modes of operation**. Each mode has its own structure, its own tools, and its own idea of what progress means. Every section below uses the same fields so new modes or tools fit the same way.

```
            ┌──────────── Capture (Inbox) ────────────┐
            ▼                  ▼                      ▼
        Practice  ──became──▶  Short form  ──promote──▶  Long form
            └──────────── Home (shared view) ─────────┘
```

### Capture: never lose an idea
- **Purpose:** catch ideas, lines, prompts, links, and research the moment they appear, on desktop or phone, without opening a note. Sort them later.
- **Structure:** `type: capture` notes with `kind:` (`idea`, `line`, `link`, `prompt`, `research`) in the Inbox folder (`00 - Inbox`). Archived captures go to `00 - Inbox/Archive`. A capture is "unsorted" as long as it sits in the Inbox, so it needs no status field.
- **Tools:** quick capture popup (command + ribbon), Inbox panel, triage, and append-to-today. See `src/capture.ts`, `src/inbox.ts`, `src/modals.ts`.
- **Feeds every mode:** triage sends a capture to
  - Practice: turn it into an exercise or a prompt note
  - Short form: send it to a story, or start a new story
  - Long form: send it to a project (research captures go to the project's `Research/`), or start a new project
  - Resources: file it, archive it, or delete it (Obsidian trash)
- **Progress signal:** ideas captured and sorted (`inkwell-contribution`), plus the inbox count.
- **Non-negotiable:** one keystroke, works on mobile.

### Mode 1: Practice. Show up.
- **Purpose:** low-stakes, daily writing. Quantity over polish. Always gives you something to write today, even with no project.
- **Structure:** `01 - Practice/` → `Journal/` (`type: journal`), `Exercises/` (`type: exercise`), `Prompts/` (`type: prompt`, one note per prompt).
- **Tools:** today's journal, new exercise (with a time goal), new prompt, random prompt (least used and oldest first), prompt of the day (`inkwell-prompt` block), prompts table (Bases). See `src/journal.ts`, `src/exercise.ts`, `src/prompts.ts`.
- **Progress signal:** did I write today? Journal entries, exercises done, minutes written, prompts used.

### Mode 2: Short form. Finish small things.
- **Purpose:** short pieces that stay light: **one hub, one draft**. No scenes or heavy structure.
- **Structure:** `02 - Stories/<Title>/` → hub `<Title>.md` (`type: story`), `<Title> - Draft.md` (`type: draft`), characters and locations, `Notes/`, `Archive/` (revision snapshots).
- **Tools:** new short story, story panel, story progress, status changes, revision snapshots (v2, v3, …), new character or location. See `src/stories.ts`, `src/storyview.ts`, `src/revisions.ts`.
- **Progress signal:** status (idea → drafting → revising → done), draft words against `target_wordcount`, last worked on, revision count.

### Mode 3: Long form. Sustain big things.
- **Purpose:** novellas, novels, and serials: work that needs scenes, a codex, and research.
- **Structure:** `03 - Projects/<Title>/` → project note (`type: storyline`, with logline, premise, outline by act, parking lot, and a scenes table), `Scenes/` (`type: scene`), `Codex/Characters/`, `Codex/Locations/`, `Notes/`, `Research/`, `Archive/`. StoryLine-compatible.
- **Tools:** new project, new scene (added at the end, numbered), project panel (same sidebar as stories), codex notes. See `src/projects.ts`, `src/storyview.ts`.
- **Progress signal:** total words across scenes against the target, words this week, scene statuses, next step.

### Shared view: Home
- **Home** (`src/home.ts`, `src/homeblocks.ts`, `src/contribution.ts`) brings everything together: inbox, in-progress pieces, practice, prompt of the day, heatmap. It is built from code blocks (`inkwell-inbox`, `inkwell-in-progress`, `inkwell-prompt`, `inkwell-practice`, `inkwell-heatmap`) that work in any note. The **New…** picker creates any Inkwell note.

## Movement between modes

Work moves **up** as it grows: capture → practice → story → project.

- **Exercise → story:** "This became a story" (`src/became.ts`). The story hub gets `from:` and the exercise gets `became:`.
- **Story → project:** "Promote story to long form" (`src/promote.ts`). The draft is archived first, then split into scenes at headings or `***` breaks. Characters and locations move to `Codex/`, and the hub becomes the project note (`promoted:` date).
- Moving up is **always optional** and **always keeps a link back** to where the work started.

## Progress & motivation model

Contribution is tracked at four levels. Each answers a different question.

| Level | Question it answers | What exists now | Status |
|---|---|---|---|
| **Session / day** | Did I show up today? | `inkwell-practice` (`src/contribution.ts`): days showed up this week, streak, exercises, prompts used, journal entries, practice words. Also KTR's `ktr-entries` in the journal. Not yet: real minutes written (`writing_min` is never filled, and exercise `minutes` is only the goal) | built |
| **Piece** | Is this story or project moving? | Words against `target_wordcount`, words this week, status, last worked on, status bar, Home in-progress list | built |
| **Mode** | Where is my writing going: capture, practice, stories, or projects? | `inkwell-contribution` (`src/contribution.ts`): counts per objective for a week, month, year, or all time (captures, exercises, journals, prompts, stories started or grown from practice, revisions, projects, scenes) plus KTR words per mode | built |
| **Lifetime / streak** | What has all this added up to? | KTR heatmap (`inkwell-heatmap`), KTR streak in `inkwell-practice`, all-time view of `inkwell-contribution`. Not yet: a dedicated writing-life view (milestones, pieces finished) | partial |

**Counting rule:** practice writing (journal, exercises) **never** counts toward a piece's progress. It **does** count toward the day and lifetime levels. Piece-level numbers come only from drafts and scenes.

## Key tenets

- **Plain notes, always.** Everything is ordinary Markdown with frontmatter. Uninstalling Inkwell loses nothing.
- **Write first, organize later.** Capture is instant. Filing is optional and can be batched.
- **Each mode is as light as its purpose.** Practice is quick, short form is one draft, and long form gets the full structure. Don't add weight to a lighter mode.
- **Build only what's missing.** Use Bases for tables, Keep the Rhythm for word logs, streaks, and heatmaps, and StoryLine for advanced long-form views. Inkwell is the glue plus what doesn't exist elsewhere.
- **Mobile from day one.** No desktop-only APIs (`isDesktopOnly: false`).
- **Not a publishing tool.** No compile, export, or submission tracking.
- **Prose only.** TTRPG and worldbuilding projects are out of scope.
- **Safe by default.** Anything that moves, splits, or rewrites notes saves the original to `Archive/` or uses Obsidian's trash first.

## Working rules (engineering)

### Data model (`type:` values)
| `type` | Where | Key fields |
|---|---|---|
| `capture` | Inbox | `kind`, `created`, `captured` (date; kept through triage so it still counts as contribution), `source` |
| `journal` | Practice/Journal | `created`, `writing_min` |
| `exercise` | Practice/Exercises | `prompt` (link), `minutes`, `became` (link) |
| `prompt` | Practice/Prompts | `tags`, `used` (count), `last_used` (date) |
| `story` | Stories/<Title> | `status`, `logline`, `genre`, `target_wordcount`, `next`, `from` |
| `draft` | Stories/<Title> (snapshots in `Archive/`) | `project`, `version`, `snapshot` (snapshots only) |
| `storyline` | Projects/<Title> | StoryLine fields (`title`, `bookId`, `language`) + `status`, `logline`, `target_wordcount`, `promoted` |
| `scene` | …/Scenes | `id`, `title`, `sequence`, `act`, `chapter`, `status`, `pov`, `characters`, `location`, `target_wordcount` |
| `character` / `location` | story folder or `Codex/` | `project`, `tagline`, … |
| `resource` | Resources | `kind`, `status`, `author`, `url` |

- Use `target_wordcount` everywhere (StoryLine's name), so promotion needs no renaming.
- Use `type: location`, not `place`. Still read `place` as an alias for older notes.
- Templates set only optional extras. Inkwell writes required fields (`type`, `status`, `project`, …) itself (`src/templates.ts`).

### Rules
- **Frontmatter writes** go through `app.fileManager.processFrontMatter` (avoids clobbering edits and sync conflicts).
- **Scene order:** `sequence` uses gaps of 10 (10, 20, 30…), so a reorder usually rewrites one file. Scene file names follow StoryLine: `<act>-<sequence> <title>`.
- **StoryLine compatibility:** long-form notes use StoryLine's frontmatter (tested against StoryLine 1.11.12). Long-form statuses default to StoryLine's (`idea, outlined, draft, written, revised, final`). Short-form statuses: `idea, drafting, revising, done`.
- **Keep the Rhythm (KTR):**
  - Optional. Inkwell works fully without it, and KTR-based numbers are simply hidden.
  - All KTR access lives in `src/integrations/keep-the-rhythm.ts`. Nothing else reads KTR data.
  - Read-only. Never write KTR data or settings.
  - Version-gated (`KTR_TESTED_VERSIONS`). On an untested version, hide stats rather than show wrong numbers. After each KTR update, check the numbers against KTR's own views before adding the version.
  - Per-piece numbers count only draft and scene files.
  - Inkwell keeps no word log, streak, or heatmap of its own. Known risk: KTR history is stored per device and may undercount across phone and desktop.
- **Settings** hold folders, template paths, status lists, and default targets (`src/settings.ts`). Never hard-code folder names.

### Build, test, release
```sh
npm install
npm run dev          # watch build
npm run build        # type-check + production build
npm run deploy:test  # build and copy into ./test-vault
```
- Develop against `test-vault/`, not a real vault.
- Release: `npm version x.y.z` bumps `package.json`, `manifest.json`, and `versions.json`. The tag equals the version with **no `v` prefix**. Pushing the tag creates a draft GitHub release, and users install via BRAT.

## Open questions & growing edges

New key concepts land here first. Move them up once they're settled.

- **Capture as a habit:** should capture have its own progress signal (ideas per week, time to inbox zero)?
- **Weekly review:** a checklist covering inbox zero, picking an exercise, and checking stalled stories. It ties Capture and the modes together.
- **Mode trends:** `inkwell-contribution` shows totals per period. A trend over time (this month vs. last) is still open.
- **Writing life:** milestones and pieces finished. Finishing needs a date: status changes don't record when a piece reached `done`.
- **Timed sprints:** a 10, 15, or 25-minute timer on any note that logs minutes to it (session/day level).
- **Shared cast:** one set of characters and locations used across related stories.
- **Manuscript view:** read all of a project's scenes as one continuous document (reading, not export).
- **Long-form views (gated):** corkboard, kanban, beat-sheet scaffolds, scene inspector. Build these only if StoryLine falls short in real use, and write down the gap first.
- **Inkwell's own word log:** only if KTR's per-device history proves unreliable. It would go behind the same one-file interface.
