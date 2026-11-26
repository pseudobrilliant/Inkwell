# Inkwell — CLAUDE.md

> **This document is meant to grow.** Inkwell's identity is still taking shape. A new key concept starts as an idea in `openspec/ideas/` and becomes an OpenSpec proposal in `openspec/changes/` when work on it starts. Once it's built, its behaviour moves into a spec in `openspec/specs/`, and the reasons behind hard-to-reverse choices go into an ADR in `openspec/decisions/` (see **Design records**). This file keeps the vision, tenets and engineering rules, plus a short summary of each mode. Keep the README (user-facing), the specs (behaviour) and this file (intent and rules) in sync when features change.

## What Inkwell is

Inkwell is a **writing-practice toolkit** for Obsidian. It helps a writer show up every day, catch every idea, and give the work that comes out of practice a place to grow: from a ten-minute exercise, to a short story, to a novel. It is **not** a publishing tool.

## Motivation & inspiration

Most writing software is built around the *end* of writing: compiling, formatting, exporting, submitting. Very little of it helps with the part that actually makes a writer: **writing regularly, catching ideas before they're lost, and letting small pieces grow into bigger ones.**

Inkwell is built on five beliefs:

1. **Practice is the work.** Daily writing, prompts, and exercises are the foundation. A finished manuscript is only one possible result.
2. **Ideas are cheap to lose and expensive to recover.** Capturing has to be instant and must never get in the way of writing.
3. **Feed the well.** Writers are made by what they take in as much as what they put out. The poem a teacher mentions or the craft book a friend recommends is raw material too, and it's as easy to lose as an idea.
4. **Write, reflect, write again.** Revising is part of practice, not a separate stage. A writer should be able to see what they changed and read the result, without losing what they first wrote.
5. **Seeing your contribution keeps you going.** A writer who can see that they showed up today, that a story moved forward this week, and that a year of practice has added up will keep writing. Progress should be visible at every level, from a single day to a whole writing life.

<!-- Author's voice: add personal motivation, inspirations, influences here as they come into focus. -->

## The shape of Inkwell: Capture + three modes

Inkwell is organized around **Capture** (feeding the well), which feeds everything, and **three modes of operation**. Each mode has its own structure, its own tools, and its own idea of what progress means. Every section below uses the same fields so new modes or tools fit the same way.

```
            ┌──────────── Capture (Inbox) ────────────┐
            ▼                  ▼                      ▼
        Practice  ──became──▶  Short form  ──promote──▶  Long form
            └──────────── Home (shared view) ─────────┘
```

### Capture: feed the well
Feeding the well is the ethos behind Capture. It has two sides, and both go through the same quick capture popup:
- **Your ideas** (Inbox): ideas, lines, prompts, links, and research, sorted later.
- **Others' work** (Resources): poems, stories, essays, articles, books, classes, and other (videos, podcasts, sites). A kind says what the thing is. Any kind can carry a URL, so where it lives is never a kind. These go straight to the resources folder (`05 - Resources`) as a reading list. Picking the kind is the only sorting at capture time. Reading and notes come later.

- **Purpose:** catch ideas and the work you want to learn from the moment they appear, on desktop or phone, without opening a note. Sort them later.
- **Structure:**
  - `type: capture` notes with `kind:` (`idea`, `line`, `link`, `prompt`, `research`) in the Inbox folder (`00 - Inbox`). Archived captures go to `00 - Inbox/Archive`. A capture is "unsorted" as long as it sits in the Inbox, so it needs no status field.
  - `type: resource` notes with `kind:` (`poem`, `story`, `essay`, `article`, `book`, `class`, `other`) and `status` (`to-do`, `in-progress`, `done`) in the resources folder, from the resource template. In the popup each kind asks for its own short fields (`RESOURCE_FIELDS` in `src/resources.ts`): a title, then the person (poet, author, or a class's teacher), where it's from (`where`: an article's site, a class's place), a class's dates (`start`, `end`, date pickers saved as `YYYY-MM-DD`), the poem itself for a poem (`text`, written as a `## Text` section through the template's `{{text}}`, never frontmatter), and a link. Enter moves to the next field and ⌘/Ctrl+Enter saves. A pasted `Title by Author` still fills an empty author, and a link pasted as the title moves to the link field. Only the kind's own fields are written to frontmatter, and the template's `{{source}}` lists the ones that were filled in. `from:` links the note you were in when you captured it.
  - **Templates:** one resource template (Source, then `{{sections}}`, then Try This). `{{sections}}` is filled from the kind's own built-in sections (`RESOURCE_SECTIONS`), kept few on purpose: a poem or story gets Reflection and Take Aways; an essay gets Take Aways; an article gets Key Ideas, Quotes, What I'll Use; a book gets Notes, Reflections, Quotes, Take Aways; a class gets Sessions, Assignments, Readings & Handouts, Take Aways; other gets Notes and Take Aways. Hints are Obsidian comments (`%% … %%`), hidden in reading view and ignored when Try This becomes an exercise prompt. A `Resource - <Kind>.md` note next to the template replaces it for that kind.
  - **Research vs resource:** `research` belongs to a project and lands in its `Research/`. A `resource` is general learning and lands in Resources.
- **Tools:** quick capture popup (command + ribbon, with a "Feed the well" row of resource kinds), capture a resource, Inbox panel, triage, append-to-today, resources table (Bases), exercise from a resource. See `src/capture.ts`, `src/resources.ts`, `src/inbox.ts`, `src/modals.ts`.
- **Feeds every mode:** triage sends a capture to
  - Practice: turn it into an exercise or a prompt note
  - Short form: send it to a story, or start a new story
  - Long form: send it to a project (research captures go to the project's `Research/`), or start a new project
  - Resources: file it, archive it, or delete it (Obsidian trash)
- **Resources feed Practice:** "Exercise from a resource" starts a timed exercise that responds to or imitates the resource (its `Try This` section, if filled in, becomes the prompt). The exercise gets `resource:`.
- **Progress signal:** ideas captured and sorted, and resources added, being read, and done (`inkwell-contribution`), plus the inbox count.
- **Non-negotiable:** one keystroke, works on mobile.

### Mode 1: Practice. Show up.
- **Purpose:** low-stakes, daily writing. Quantity over polish. Always gives you something to write today, even with no project.
- **Structure:** `01 - Practice/` → `Journal/` (`type: journal`) and `Exercises/`, which holds `Prompts/` (`type: prompt`, one note per prompt), `Drills/` (`type: drill`, one note per drill, from the drill template), and `Writing/` (`type: exercise`: the writing you did; setting `folders.writings`).
- **Tools:** today's journal, new exercise (with a time goal; its Work section starts with a writing block), new prompt, random prompt (least used and oldest first), new drill, exercise from a drill (the open drill note, or a pick; the drill's `minutes` sets the timer goal), add starter drills (five common drills, skips existing), prompt of the day (`inkwell-prompt` block), prompts table (Bases), writing timer. See `src/journal.ts`, `src/exercise.ts`, `src/prompts.ts`, `src/drills.ts`, `src/timer.ts`, `src/timerstate.ts`.
- **Writing timer:** one timer at a time on an exercise or journal. It starts on the first keystroke, pauses by itself when you stop typing, and stop adds whole minutes to `writing_min`. Works on mobile, and each device times its own writing. Behaviour: [`openspec/specs/writing-timer/spec.md`](openspec/specs/writing-timer/spec.md). Why device-local storage: [ADR 0003](openspec/decisions/0003-timer-state-in-device-local-storage.md). The state machine is pure (`src/timerstate.ts`); `src/timer.ts` is the UI around it.
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

### Core component: writing blocks
Writing blocks are not a mode. They're a core component that supports features across Capture, Practice and the writing modes, starting with exercises.
- **What it is:** a `> [!writing]` callout that holds the writing itself, edited as a styled box with the Markdown hidden. Its toolbar has Draft, Review and Edited.
- **The first draft** is kept in a `%% writing-block first-draft <mode> … %%` comment just below the block. Review shows a live diff against it, so nothing is accepted or rejected.
- **Behaviour:** [`openspec/specs/writing-blocks/spec.md`](openspec/specs/writing-blocks/spec.md). The format: [ADR 0006](openspec/decisions/0006-writing-block-first-draft-in-a-comment.md).
- **Code:** `src/writingblock*.ts` are self-contained. They import only Obsidian, CodeMirror and each other (lint enforces it), so they could become their own plugin later. That isn't planned. Inkwell's side, such as the KTR notice and the commands, is `src/blockhost.ts`.
- **Typewriter Mode:** if installed, it's turned on while the writer is writing in a block and off when they leave, through its own enable/disable commands. The editor reports through `WritingBlockHost.onWritingInBlock`; all Typewriter Mode access lives in `src/integrations/typewriter-mode.ts`.
- **Next:** the timer moves into the block's toolbar (`openspec/ideas/writing-block-timer.md`), and other block types may follow (`writing-block-types.md`).

## Movement between modes

Work moves **up** as it grows: capture → practice → story → project.

- **Exercise → story:** "This became a story" (`src/became.ts`). The story hub gets `from:` and the exercise gets `became:`. Writing blocks carry only their current text, as plain paragraphs.
- **Story → project:** "Promote story to long form" (`src/promote.ts`). The draft is archived first, then writing blocks are unwrapped to their current text and the draft is split into scenes at headings or `***` breaks. Characters and locations move to `Codex/`, and the hub becomes the project note (`promoted:` date).
- Moving up is **always optional** and **always keeps a link back** to where the work started.

## Progress & motivation model

Contribution is tracked at four levels. Each answers a different question.

| Level | Question it answers | What exists now | Status |
|---|---|---|---|
| **Session / day** | Did I show up today? | `inkwell-practice` (`src/contribution.ts`): days showed up this week, streak, exercises, prompts used, journal entries, minutes written (`writing_min`, from the writing timer), practice words. Also KTR's `ktr-entries` in the journal | built |
| **Piece** | Is this story or project moving? | Words against `target_wordcount`, words this week, status, last worked on, status bar, Home in-progress list | built |
| **Mode** | Where is my writing going: capture, practice, stories, or projects? | `inkwell-contribution` (`src/contribution.ts`): counts per objective for a week, month, year, or all time (captures, resources added/reading/done, exercises, journals, prompts, stories started or grown from practice, revisions, projects, scenes) plus KTR words per mode | built |
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

## Design records

- **Behaviour** lives in `openspec/specs/<capability>/spec.md`: one living spec per capability, with requirements in EARS sentences and scenarios that name their tests. Conventions are in `openspec/config.yaml`. So far: `writing-timer`. The other capabilities are still described in the sections above.
- **Ideas and open questions** live in `openspec/ideas/<id>.md`, one short file each, indexed in `openspec/ideas/README.md`. They are not OpenSpec changes, so `changes/` only holds work in progress.
- **Changes in progress** live in `openspec/changes/<id>/`. Picking up an idea makes it a proposal (the `openspec-propose` skill, or `npx openspec new change <id>`) and deletes the idea file. Once it's built, archive it (`npx openspec archive <id>`), which merges its spec changes into the specs.
- **Decisions** live in `openspec/decisions/` as ADRs. Write one for a decision that's hard to reverse or that picks between real options. Never rewrite an accepted ADR: supersede it with a new one. See `openspec/decisions/README.md`.
- **Keep them true:** a change to behaviour updates its spec in the same commit. `npm run spec` validates the specs and changes, and checks that every scenario's `Test:` line names a test that exists (`scripts/check-spec-tests.mjs`). It runs in `npm run check` and CI.
- **When a capability gets a spec,** replace its detail in this file with a short summary and a link.

## Working rules (engineering)

### Data model (`type:` values)
| `type` | Where | Key fields |
|---|---|---|
| `capture` | Inbox | `kind`, `created`, `captured` (date; kept through triage so it still counts as contribution), `source` |
| `journal` | Practice/Journal | `created`, `writing_min` (minutes logged by the timer) |
| `exercise` | Practice/Exercises/Writing | `prompt` (link), `drill` (link), `resource` (link), `minutes` (goal), `writing_min` (minutes logged by the timer), `became` (link) |
| `prompt` | Practice/Exercises/Prompts | `tags`, `used` (count), `last_used` (date) |
| `drill` | Practice/Exercises/Drills | `tags`, `skill`, `minutes` (suggested time) |
| `story` | Stories/<Title> | `status`, `logline`, `genre`, `target_wordcount`, `next`, `from` |
| `draft` | Stories/<Title> (snapshots in `Archive/`) | `project`, `version`, `snapshot` (snapshots only) |
| `storyline` | Projects/<Title> | StoryLine fields (`title`, `bookId`, `language`) + `status`, `logline`, `target_wordcount`, `promoted` |
| `scene` | …/Scenes | `id`, `title`, `sequence`, `act`, `chapter`, `status`, `pov`, `characters`, `location`, `target_wordcount` |
| `character` / `location` | story folder or `Codex/` | `project`, `tagline`, … |
| `resource` | Resources | `kind`, `status` (`to-do`, `in-progress`, `done`), `author` (or `teacher` for a class), `where`, `start`/`end` (a class's dates), `url`, `created`, `captured`, `from` (link to the note it was captured from). Older kinds read as aliases: `course` → `class`, `craft-book` → `book`, `link`/`website`/`video`/`podcast`/`tool` → `other` |

- Use `target_wordcount` everywhere (StoryLine's name), so promotion needs no renaming.
- Use `type: location`, not `place`. Still read `place` as an alias for older notes.
- Templates set only optional extras. Inkwell writes required fields (`type`, `status`, `project`, …) itself (`src/templates.ts`).

### Rules
- **Frontmatter writes** go through `app.fileManager.processFrontMatter` (avoids clobbering edits and sync conflicts). Type the callback parameter as `Frontmatter`.
- **Frontmatter reads** go through `fmOf(app, file)` (typed `Record<string, unknown>`), and values become text through `fmStr()`. Never `String(fm.x)`: a YAML list or object would show as `[object Object]` (`src/util.ts`).
- **Obsidian plugin guidelines** (enforced by lint): sentence case for all UI text, including command names and notices. Don't disable `obsidianmd/*` rules inline (the config forbids it), so reword the text instead. Use `instanceof`/`getFileByPath`/`getFolderByPath` rather than casting to `TFile`/`TFolder`. Use `activeDocument`/`activeWindow`, not `document`/`window` globals (for popout windows), except timers: lint requires `window.setInterval`/`window.setTimeout`. Build DOM with `createEl`, never `innerHTML`. Styles go in `styles.css` with Obsidian CSS variables, never `el.style`. No default hotkeys. Use the Vault API, not `vault.adapter`. The one exception is reading another plugin's file under `configDir`, which the vault doesn't index. TypeScript is `strict` with `noUncheckedIndexedAccess`.
- **Scene order:** `sequence` uses gaps of 10 (10, 20, 30…), so a reorder usually rewrites one file. Scene file names follow StoryLine: `<act>-<sequence> <title>`.
- **StoryLine compatibility:** long-form notes use StoryLine's frontmatter (tested against StoryLine 1.11.12). Long-form statuses default to StoryLine's (`idea, outlined, draft, written, revised, final`). Short-form statuses: `idea, drafting, revising, done`.
- **Keep the Rhythm (KTR):**
  - Optional. Inkwell works fully without it, and KTR-based numbers are simply hidden.
  - All KTR access lives in `src/integrations/keep-the-rhythm.ts`. Nothing else reads KTR data.
  - Read-only. Never write KTR data or settings.
  - Version-gated (`KTR_TESTED_VERSIONS`). On an untested version, hide stats rather than show wrong numbers. After each KTR update, check the numbers against KTR's own views before adding the version.
  - Per-piece numbers count only draft and scene files.
  - Inkwell keeps no word log, streak, or heatmap of its own. Known risk: KTR's live history is per device (IndexedDB). Its `data.json`, which Inkwell reads, is a copy written about a second after activity, and when it syncs in from another device KTR merges entries by auto-numbered `id`, which each device assigns on its own, so one device's day can overwrite another's. Expect undercounts across phone and desktop.
  - Parsing and sums over KTR's data are pure functions (`usableData`, `dailyWordsIn`, `streakIn`, `weekStartFor`, `ignoresCommentsIn`), tested against a trimmed `data.json`.
  - Writing blocks keep their first draft in a comment, so KTR's "Don't count comments" setting (`settings.ignoreComments`) must be on for honest counts. Inkwell reads it to warn on the first review, and never sets it.
- **Settings** hold folders, template paths, status lists, and default targets (`src/settings.ts`). Never hard-code folder names. The settings file syncs across devices, so keep fast-changing or per-device state out of it: use `app.saveLocalStorage` (the timer, the last capture kind). `onExternalSettingsChange` reloads settings when sync changes the file, so a save never overwrites another device's change. Loading goes through the pure `mergeSettings` (defaults, migrations); controls go through `controlValue`/`applyControlValue`.
- **Settings tab is declarative** (Obsidian 1.13+, so `minAppVersion` is 1.13.0). Add a setting by adding a definition in `getSettingDefinitions()`, which makes it appear in Obsidian's settings search. Don't add a `display()` method. Nested settings use dotted control keys (`folders.inbox`). Every key must be handled in both `getControlValue` and `setControlValue`, where values are normalized (trimmed, with defaults as fallback).

### Build, test, release
```sh
npm install
npm run dev          # watch build
npm run build        # type-check + production build
npm run lint         # Obsidian's official ESLint rules (eslint-plugin-obsidianmd)
npm test             # unit tests (Vitest); npm run test:watch while working
npm run spec         # validate OpenSpec specs and changes, and their Test: references
npm run check        # lint + spec + test + build; run before every commit
npm run deploy:test  # build and copy into ./test-vault
```
- Develop against `test-vault/`, not a real vault.
- **Tests** live in `tests/` and run in Node. `obsidian` is aliased to a small stand-in (`tests/helpers/obsidian.ts`), and `tests/helpers/fake-app.ts` is an in-memory vault (frontmatter parsed from file text, strict like Obsidian about existing files and missing folders) with `fakePlugin()` for code that takes the plugin. Keep logic that can be pure in pure functions and test it there; test flows that move or rewrite notes (promote, snapshots, triage) against the fake vault, including the "original is kept first" rule. The `obsidian` types are pinned to `minAppVersion`, so the type-check catches APIs newer than the oldest supported app.
- **Lint must pass with zero errors.** `eslint-plugin-obsidianmd` is the same rule set Obsidian's automated review runs on every release (since May 2026). A release that fails it is removed from the community directory search. CI runs lint, spec validation, tests, and build on every push (`.github/workflows/lint.yml`).
- Release: `npm version x.y.z` bumps `package.json`, `manifest.json`, and `versions.json`. The tag equals the version with **no `v` prefix**. Pushing the tag lints, tests, builds, attests build provenance for `main.js` and `styles.css`, and creates a draft GitHub release. Users install via BRAT.

## Open questions & growing edges

Open questions are ideas in `openspec/ideas/` (see its README for the index). Gated ones (`long-form-views`, `own-word-log`) wait on evidence named in their ADRs. Work in progress is listed by `npx openspec list`. New key concepts start as an idea, not here.
