# Inkwell

**A writing-practice plugin for Obsidian.**

Inkwell helps you build a steady writing habit and gives you structure for the work that comes out of it. It organizes three kinds of writing, each a step in a practice:

1. **Practice:** daily journals, prompts, and timed exercises.
2. **Stories:** short pieces, each with one draft and a light folder around it.
3. **Projects:** long-form work (novellas, novels, serials) organized into scenes, a codex, and research.

## What Inkwell is for

Many writing tools are built around publishing a finished manuscript: compiling, formatting, exporting. Inkwell isn't. It's for the everyday part of writing:

- **Showing up.** A daily journal, prompts, and exercises give you something to write today, even when you have no project.
- **Catching ideas.** Quick capture sends a thought to your Inbox with one keystroke, from desktop or phone. You sort it later.
- **Turning practice into stories.** When an exercise turns into something more, you can promote it to a short story, and Inkwell keeps a link back to where it started.
- **Keeping stories and projects organized.** Each short story gets a simple folder with a hub note, a draft, its characters and places, and a record of past revisions. A project gets scenes, a codex for characters and locations, and room for notes and research.
- **Seeing your progress.** A Home dashboard shows your inbox, what's in progress, the prompt of the day, and your writing activity.

## What Inkwell is not

Inkwell is **not** a publishing or export tool. It won't compile a manuscript, format submissions, or export to DOCX/PDF, and those features aren't planned.

Inkwell helps you organize and write projects, but it stops short of publishing them. Because everything is plain Markdown, you can take a finished project to whatever tool you use to compile and publish.

## Principles

- **Plain notes, always.** Everything Inkwell makes is an ordinary Markdown note with frontmatter. If you uninstall it, your writing stays where it is.
- **Write first, organize later.** Capturing is instant. Sorting is optional and can wait for a weekly review.
- **Keep it light.** A short story is one folder and one draft, not a whole system to maintain.
- **Works on mobile.** Every feature works in Obsidian mobile.
- **Build only what's missing.** Inkwell works alongside Bases and Keep the Rhythm (word counts, streaks, heatmaps) instead of rebuilding what they already do.

## Features

### Capture & Inbox
- **Quick capture** (command + ribbon): a small popup for an idea, a line, a link, a prompt, or a research note. It goes straight to the Inbox without opening a note.
- **Inbox panel:** your unsorted captures, newest first.
- **Triage:** send a capture to a story or project (research captures land in a project's `Research/` folder), turn it into an exercise or prompt, start a new story or project from it, file it as a resource, archive it, or delete it.
- **Append to today:** optionally log each capture in today's journal too.

### Practice
- **Today's journal:** opens or creates today's journal entry.
- **Prompts:** one small note per prompt, tracking how often and how recently you've used it, with a sortable Prompts table.
- **Random prompt:** picks the prompts you've used least and longest ago first.
- **Prompt of the day:** appears in the journal and on Home.
- **Exercises:** start an exercise from a prompt with a time goal.
- **Drills:** repeatable practice for one skill (freewriting, sensory detail, dialogue…). Create your own with **New drill**, add five common ones with **Add starter drills**, and start a timed exercise from one with **Exercise from a drill** (it uses the open drill note, or asks which one).
- **Writing timer:** exercises (new ones, including from a random prompt or a drill, and ones you reopen) and today's journal get a timer that starts when you begin typing. It pauses on its own when you stop typing for a while and picks up again when you type. Pause, reset, or stop it from the status bar, the timer button at the top of the note (on mobile too), or commands you can bind to hotkeys. Stopping adds the minutes to the note's `writing_min`, and **Practice this week** shows minutes written.
- **This became a story:** promote an exercise into a short story, with a link back to it.

### Stories
- **New short story:** builds a folder with a hub note (logline, premise, outline, status, next step) and a draft.
- **Characters & locations:** notes that work the same way in stories and projects. In a project they go to `Codex/`.
- **Story panel:** a sidebar with the hub summary, draft word count, characters, notes, and next step. It also works for projects (see below).
- **Progress:** status (idea → drafting → revising → done), word count against a target, and when you last worked on it.
- **Revisions:** snapshot the draft as v2, v3, … with old versions moved to `Archive/`.

### Projects
- **New project:** asks for a title, logline, genre, and word target, then builds the layout: a project note (logline, premise, outline by act, a parking lot for loose ideas, and a table of scenes), plus `Scenes/`, `Codex/Characters/`, `Codex/Locations/`, `Notes/`, `Research/`, and `Archive/`.
- **New scene:** adds a scene at the end of the current project (or one you pick), numbered so scenes stay in order.
- **Project panel:** the same sidebar shows a project's status, word count against its target, words this week, next step, scenes in order with status and word count, characters, locations, notes, and research.
- **Progress:** projects appear on Home's in-progress list and in the status bar, with total words across scenes.
- **Promote a story:** if a short story outgrows one draft, Inkwell can turn it into a project, splitting the draft into scenes at headings or `***` breaks and moving its characters and locations into the codex. The original draft is archived first.

### Home
- A built-in **Home** dashboard (command + ribbon).
- Code blocks you can use in any note: `inkwell-inbox`, `inkwell-in-progress`, `inkwell-prompt`, `inkwell-practice`, `inkwell-contribution`, `inkwell-heatmap`.
- **Practice this week** (`inkwell-practice`): which days you showed up, your streak, and the exercises, prompts, journal entries, minutes written, and practice words for the week.
- **Your contribution** (`inkwell-contribution`): what you added to each part of your writing this week, month, year, or all time: ideas captured and sorted; exercises, journal entries, and prompts used; stories started, grown from practice, and revised; projects started or promoted and scenes added. Word counts per mode appear when Keep the Rhythm is installed.
- A **New…** picker that creates any Inkwell note from one command.

## Installation

Inkwell isn't in the community plugin directory yet. Install it with [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Install and enable BRAT.
2. Run **BRAT: Add a beta plugin** and enter this repository's URL.
3. Enable **Inkwell** in Settings → Community plugins.
4. Open Inkwell's settings to set your folders, then run **Inkwell: Write default templates**.

Keep the Rhythm is optional. If it's installed, Inkwell uses it for word counts per story and for heatmaps.

## Default folders

All of these can be changed in settings.

| Folder | Holds |
|---|---|
| `00 - Inbox` | Captures |
| `01 - Practice` | `Journal/`, `Writings/` (your exercises), and `Exercises/` with `Prompts/` and `Drills/` |
| `02 - Stories` | Short stories |
| `03 - Projects` | Long-form projects |
| `05 - Resources` | Filed resources |

## Development

```sh
npm install
npm run dev          # watch build
npm run build        # type-check + production build
npm run lint         # Obsidian's official plugin lint rules
npm run deploy:test  # build and copy into ./test-vault
```

## License

MIT
