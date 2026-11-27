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
- **Feeding the well.** The same popup saves the work you want to learn from (a poem, a novel or craft book, a blog post, a class, a video) to your Resources, with a note to fill in when you read it.
- **Writing, reflecting, writing again.** Writing blocks give the writing itself a home: draft in a clean box, then review what you changed since the first draft, then read the edited version.
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
- **Build what's core, use the rest.** Writing, word counts and goals are Inkwell's own. For tables it uses Bases instead of rebuilding them.

## Features

### Capture & Inbox
- **Quick capture** (command + ribbon): a small popup for an idea, a line, a link, a prompt, or a research note. It goes straight to the Inbox without opening a note.
- **Inbox panel:** your unsorted captures, newest first.
- **Triage:** send a capture to a story or project (research captures land in a project's `Research/` folder), turn it into an exercise or prompt, start a new story or project from it, file it as a resource, archive it, or delete it.
- **Append to today:** optionally log each capture in today's journal too.

### Feeding the well (resources)
- **Capture a resource:** in quick capture, pick a kind under **Feed the well** (poem, story, essay, article, book, class, or other for videos, podcasts and sites), then fill in its short form. Each kind asks for what fits it: a poem asks for the poet and lets you paste the poem itself, an article for the author and site, a class for the class name, teacher, where, and its start and end dates. Only the title is really needed. Enter moves to the next field and ⌘/Ctrl+Enter saves. It goes straight to `05 - Resources` as `to-do`, with a link back to the note you were in, so you can capture one or two things from an email and keep reading. **Capture a resource** opens the popup on a resource kind.
- **Resource template:** every resource note lists its source and ends with **Try This**, and in between it gets a few sections that suit its kind. A poem or story gets a reflection and take aways, an essay take aways, an article key ideas, quotes, and what you'll use. A book gets notes, reflections, quotes, and take aways. A class gets sessions, assignments, readings and handouts, and take aways. Put a `Resource - Poem.md` (or `Book`, `Article`…) note next to the resource template to use a different one for that kind.
- **Resources table:** a Bases table of what to read, grouped by status, plus everything you've saved.
- **Exercise from a resource:** start a timed exercise that responds to or imitates a resource (the open one, or one you pick). Its **Try This** section becomes the prompt.

### Writing blocks
A writing block is a box for the writing itself, apart from the prompt, goal and notes around it. It looks like a typed page: a typewriter font, each paragraph indented like a tab. You can use one in any note, and new exercises start with one.
- **New writing block** (command or right-click): adds an empty block, wraps the selected text in one, or turns writing you indented with tabs into one.
- **Write in the box:** you only ever see your writing, never Markdown. Enter always starts a new paragraph, and the down arrow takes you out of the block below it. **Shift+Enter** starts a new line in the same paragraph, without the indent, for verse or a sign-off.
- **Draft, Review, Edited:** every block has a toolbar with three modes, and you can switch between them at any time.
  - **Draft** is where you write. Once you've reviewed, Draft shows your first draft, read-only.
  - **Review** shows what you've changed since the first draft while you keep revising: added words are highlighted and underlined, removed words are struck through.
  - **Edited** shows the revised text, clean.
- **Word count:** every block's toolbar shows how many words it holds, as you type. Once you've reviewed, Review and Edited also show how far you've come from the first draft, such as **6 words (+2)**.
- **Your first draft stays in the note.** The first time you review a block, Inkwell saves its text as the first draft, in a hidden comment just below it, folded to one line. Click it if you ever want to edit it by hand. Nothing ever needs accepting or rejecting.
- **Typewriter Mode:** if you have the Typewriter Mode plugin, Inkwell turns it on while you write in a block and off when you leave, so its focus tools are there only while you write. Its own settings (folders, platforms, which features are on) still apply.
- **Words you type in a block count** toward your day, your week and the piece (see **Words**). Words outside blocks don't.
- Moving work up (**This became a story**, **Promote**) carries a block's current text into a writing block in the new note, never the first draft, so it keeps counting.
- Without Inkwell, a block is an ordinary callout and the first draft an ordinary comment, so nothing is lost.

### Practice
- **Today's journal:** opens or creates today's journal entry, with a writing block for the day's writing.
- **Prompts:** one small note per prompt, tracking how often and how recently you've used it, with a sortable Prompts table.
- **Random prompt:** picks the prompts you've used least and longest ago first.
- **Prompt of the day:** appears in the journal and on Home.
- **Exercises:** start an exercise from a prompt with a time goal. Its Work section starts with a writing block.
- **Drills:** repeatable practice for one skill (freewriting, sensory detail, dialogue…). Create your own with **New drill**, add five common ones with **Add starter drills**, and start a timed exercise from one with **Exercise from a drill** (it uses the open drill note, or asks which one).
- **Writing timer:** exercises (new ones, including from a random prompt or a drill, and ones you reopen) and today's journal get a timer that starts when you begin typing. It pauses on its own when you stop typing for a while and picks up again when you type. Pause, reset, or stop it from the status bar, the timer button at the top of the note (on mobile too), or commands you can bind to hotkeys. Stopping adds the minutes to the note's `writing_min`, and **Practice this week** shows minutes written. Each device keeps its own timer.
  - **In an exercise's writing block,** the timer sits in the block's toolbar instead of at the top of the note: the time, and a ring that fills toward your goal. Tap it for the same menu. Only drafting in the block counts, so reading the prompt or writing your reflection doesn't. The first time you switch the block to Review, the timer stops and logs your minutes; if another block is still in Draft, a new timer gets ready for it.
- **This became a story:** promote an exercise into a short story, with a link back to it.

### Stories
- **New short story:** builds a folder with a hub note (logline, premise, outline, status, next step) and a draft that starts with a writing block.
- **Characters & locations:** notes that work the same way in stories and projects. In a project they go to `Codex/`.
- **Story panel:** a sidebar with the hub summary, draft word count, words this week, the days you wrote on it, characters, notes, and next step. It also works for projects (see below).
- **Put in a writing block:** a draft written before blocks, as plain paragraphs, isn't counted. The story panel says so and offers to put it in a writing block, keeping the text as it is.
- **Progress:** status (idea → drafting → revising → done), word count against a target, and when you last worked on it.
- **Revisions:** snapshot the draft as v2, v3, … with old versions moved to `Archive/`.

### Projects
- **New project:** asks for a title, logline, genre, and word target, then builds the layout: a project note (logline, premise, outline by act, a parking lot for loose ideas, and a table of scenes), plus `Scenes/`, `Codex/Characters/`, `Codex/Locations/`, `Notes/`, `Research/`, and `Archive/`.
- **New scene:** adds a scene at the end of the current project (or one you pick), numbered so scenes stay in order. It starts with a writing block.
- **Project panel:** the same sidebar shows a project's status, word count against its target, words this week, the days you wrote on it, next step, scenes in order with status and word count, characters, locations, notes, and research. Scenes without a writing block are marked, with **Put in a writing block**.
- **Progress:** projects appear on Home's in-progress list and in the status bar, with total words across scenes.
- **Promote a story:** if a short story outgrows one draft, Inkwell can turn it into a project, splitting the draft into scenes at headings or `***` breaks and moving its characters and locations into the codex. Each scene holds its writing in a writing block, made from the current text only, so a break inside a first draft never splits a scene. The original draft is archived first.

### Home
- A built-in **Home** dashboard (command + ribbon).
- Code blocks you can use in any note: `inkwell-inbox`, `inkwell-in-progress`, `inkwell-prompt`, `inkwell-practice`, `inkwell-contribution`, `inkwell-words`, `inkwell-heatmap`.
- **Words** (`inkwell-words`): words today, this week, and this month with your daily average, and your streak, current and best. With goals on, today and this week show a bar against your daily and weekly goals, and how many goal days you've had this week.
- **Heatmap** (`inkwell-heatmap`): one square per day, shaded by the words you wrote. Options: `weeks` (24 by default), `of` (`pieces`, the default, for story drafts and scenes; or `practice`, `stories`, `projects`, `all`), and `stops`, the word counts where the shade steps up (`1, 100, 500, 1000` by default). Home shows 48 weeks of all your writing.
- **Practice this week** (`inkwell-practice`): which days you showed up (days you wrote words in a writing block), with a ring on the days you met your daily goal, your streak, and the exercises, prompts, journal entries, minutes written, and practice words for the week.
- **Your contribution** (`inkwell-contribution`): what you added to each part of your writing this week, month, year, or all time: ideas captured and sorted; resources added, being read, and done; exercises, journal entries, and prompts used; stories started, grown from practice, and revised; projects started or promoted and scenes added, with the words you wrote in each.
- A **New…** picker that creates any Inkwell note from one command.

### Words
Inkwell counts the words you type in writing blocks and keeps a log of them, so every number it shows (today, this week, a story's words this week, your streak, the heatmap) comes from your own writing.
- **What counts:** the words you add or cut in a writing block, net, per note per day. Cutting more than you add makes a negative day, and a day only counts as showing up when its words are above zero. Writing outside blocks, the hidden first draft, and changes Inkwell or sync makes (a new note, promote, a mode switch, an edit on another device) never count.
- **Practice counts for your day, never for a piece.** A piece's words this week come only from its draft or scenes.
- **The log is plain notes,** in `99 - System/Inkwell/Word log` (changeable in settings): one folder per device and one note per month, with a table of date, note, and words. Each device writes only its own notes and Inkwell adds them all up, so syncing a phone and a desktop never loses a day. If you rename a note, the device you renamed it on updates its own log.
- **Week starts on** (settings): the first day of the week for every weekly number. Monday by default.

#### Goals
- **A daily and a weekly word goal** (settings, under Words): 300 a day and 1,500 a week to start. Each is set on its own, and 0 turns it off.
- **All your writing counts toward them:** journals, exercises, drafts and scenes, on every device. Practice still never counts toward a piece.
- **Goal days are their own number.** A day that reaches the daily goal is a goal day. Your streak still counts every day you wrote something, so a short day keeps it, and the weekly goal counts the week's words however they're spread: you can miss a day and still make the week.
- **A notice when you reach a goal,** once a day and once a week, on the device you were typing on.
- **No scolding:** a goal you haven't met shows only your words so far.

## Installation

Inkwell isn't in the community plugin directory yet. Install it with [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Install and enable BRAT.
2. Run **BRAT: Add a beta plugin** and enter this repository's URL.
3. Enable **Inkwell** in Settings → Community plugins.
4. Open Inkwell's settings to set your folders, then run **Inkwell: Write default templates**.

## Default folders

All of these can be changed in settings.

| Folder | Holds |
|---|---|
| `00 - Inbox` | Captures |
| `01 - Practice` | `Journal/`, and `Exercises/` with `Prompts/`, `Drills/`, and `Writing/` (your exercises) |
| `02 - Stories` | Short stories |
| `03 - Projects` | Long-form projects |
| `05 - Resources` | Resources: what you're reading and learning from |
| `99 - System/Inkwell/Word log` | The word log: one folder per device, one note per month |

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
