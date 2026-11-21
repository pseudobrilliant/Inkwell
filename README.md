# Inkwell

**A writing-practice plugin for Obsidian.**

Inkwell helps you build a steady writing habit and gives you structure for the small and medium-sized work that comes out of it: daily journals, timed exercises, prompts, captured ideas, short stories, and longer projects.

## What Inkwell is for

Many writing tools are built around publishing a finished manuscript: compiling, formatting, exporting. Inkwell isn't. It's for the everyday part of writing:

- **Showing up.** A daily journal, prompts, and exercises give you something to write today, even when you have no project.
- **Catching ideas.** Quick capture sends a thought to your Inbox with one keystroke, from desktop or phone. You sort it later.
- **Turning practice into stories.** When an exercise turns into something more, you can promote it to a short story, and Inkwell keeps a link back to where it started.
- **Keeping projects organized.** Each short story gets a simple folder with a hub note, a draft, its characters and places, and a record of past revisions. Longer work gets a long-form project with scenes and a codex for characters and locations.
- **Seeing your progress.** A Home dashboard shows your inbox, what's in progress, the prompt of the day, and your writing activity.

## What Inkwell is not

Inkwell is **not** a publishing or export tool. It won't compile a manuscript, format submissions, or export to DOCX/PDF, and those features aren't planned.

Inkwell helps you organize and write long-form projects, but it stops short of publishing them. Because everything is plain Markdown, you can take a finished project to whatever tool you use to compile and publish.

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
- **Triage:** send a capture to a story, turn it into an exercise or prompt, start a new short story from it, file it as a resource, archive it, or delete it.
- **Append to today:** optionally log each capture in today's journal too.

### Practice
- **Today's journal:** opens or creates today's journal entry.
- **Prompts:** one small note per prompt, tracking how often and how recently you've used it, with a sortable Prompts table.
- **Random prompt:** picks the prompts you've used least and longest ago first.
- **Prompt of the day:** appears in the journal and on Home.
- **Exercises:** start an exercise from a prompt with a time goal.
- **This became a story:** promote an exercise into a short story, with a link back to it.

### Short stories
- **New short story:** builds a folder with a hub note (logline, premise, outline, status, next step) and a draft.
- **Characters & locations:** notes that work the same way in every story.
- **Story panel:** a sidebar with the hub summary, draft word count, characters, notes, and next step.
- **Progress:** status (idea → drafting → revising → done), word count against a target, and when you last worked on it.
- **Revisions:** snapshot the draft as v2, v3, … with old versions moved to `Archive/`.

### Long-form projects
- **Project layout:** a project note, a `Scenes/` folder, and a `Codex/` for characters and locations, plus `Notes/` and `Archive/`.
- **Progress on Home:** long-form projects show up in the in-progress list with their total word count.
- **Promote a short story:** if a short story outgrows one draft, Inkwell can split it into scenes at headings or `***` breaks and move its characters and locations into the codex. The original draft is archived first.

### Home
- A built-in **Home** dashboard (command + ribbon).
- Code blocks you can use in any note: `inkwell-inbox`, `inkwell-in-progress`, `inkwell-prompt`, `inkwell-heatmap`.
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
| `01 - Writing` | Short stories |
| `02 - Long Projects` | Stories promoted to long form |
| `04 - Practice` | Journal, exercises, prompts |
| `05 - Resources` | Filed resources |

## Development

```sh
npm install
npm run dev          # watch build
npm run build        # type-check + production build
npm run deploy:test  # build and copy into ./test-vault
```

## License

MIT
