
Type
plan
Status
draft
Created
2026-11-20
Updated
2026-11-21
Inkwell — writing plugin feature list & plan
[!abstract] One line A single Obsidian plugin that runs this vault's writing life: capture → practice → short stories → long-form projects, built small and grown over time.

Plugin name: Inkwell.

1. Principles
Plain notes, always. Everything is a normal Markdown note with frontmatter. Uninstall the plugin and nothing is lost or locked up.
Write first, organize later. Capture is one keystroke; filing is optional and can be done in batches.
Two sizes of project. Short stories stay light (one folder, one draft). Long-form gets the full structure. Promoting short → long is one command.
StoryLine-compatible. Long-form notes use StoryLine's frontmatter (type: scene, characters, status…) so both plugins can read the same project while this one grows.
Build what's missing, not what exists. Bases for tables/boards, Keep the Rhythm for streaks, StoryLine for long-form views. Inkwell adds the glue and the views that don't exist yet (capture, practice, short form).
Grow in small versions. Each version is usable on its own.
Mobile from day one. Everything works in Obsidian mobile (no desktop-only APIs); quick capture is tested on the phone from 0.1.
Prose only. TTRPG and worldbuilding projects (03 - TTRPGs & Worlds) stay outside the plugin.
2. Modules & features
The Version column is the roadmap version (§4) that ships the feature. The roadmap is the single source of truth for scheduling.

A. Capture & Inbox
Feature	Version
Quick capture command/hotkey: a small popup, type a thought, it lands in 00 - Inbox (no note opens)	0.1
Capture kinds: idea, line/snippet, image/link, prompt, research — set as kind:	0.1
Mobile capture (works in Obsidian mobile)	0.1
Inbox panel: list of unsorted captures, newest first, with count	0.2
Triage actions on each capture: send to a story/project, turn into an exercise, turn a prompt capture into a prompt note, make a new short story, file as resource, archive, delete	0.2
Append-to-today: optionally also log the capture in today's journal	0.2
Weekly review checklist: inbox zero, pick an exercise, check stalled stories	0.8+
Inbox rules: a capture is "unsorted" while it sits in 00 - Inbox — no status field needed. Archive moves it to 00 - Inbox/Archive; delete uses Obsidian's trash (recoverable).

B. Practice — journal, exercises, prompts
Feature	Version
Today's journal command (replaces the current ⌘⇧D template, same folder: 04 - Practice/Journal)	0.1
New exercise from a prompt: picks or asks for a prompt, sets a timer goal, files to 04 - Practice/Exercises	0.1
Prompt notes: one small note per prompt in 04 - Practice/Prompts (tags, used, last_used), shown together in a Bases table you can sort and filter	0.1
Random prompt command: prefers prompts with the lowest used, then oldest last_used	0.1
Prompt of the day shown in the journal and on Home	0.2
"This became a story": promote an exercise into a short story, keeping a link back	0.2
Timed sprint: start a 10/15/25-min writing timer on any note; logs minutes to the note	0.8+
C. Short form (short stories)
Layout (light):

01 - Writing/<Title>/
  <Title>.md           hub: logline, premise, outline, status, links
  <Title> - Draft.md   the actual story (one note)
  Notes/               optional: scraps, research, feedback
  Archive/             old draft versions (revision snapshots)
  (characters & places as notes in the folder, type: character / location)
Feature	Version
New short story command: asks title/logline/genre, builds the layout	0.1
Short-story templates: hub, draft, character, location — template files in 99 - System/Templates, paths set in settings	0.1
Progress: status (idea → drafting → revising → done), draft word count vs target_wordcount, last worked on = draft file's modified date (practice writing doesn't count toward it)	0.1
Story panel (side): hub summary, draft word count, characters, notes, next step	0.3
Revision passes: snapshot the draft as Draft v2, v3… (old versions go to Archive/) and compare word counts	0.3
Promote to long form: copy the original draft to Archive/ first, then split it into scenes at headings/***, move characters to the codex, create the long-form project	0.3
D. Long form (novellas, novels, serials)
Layout (StoryLine-compatible):

02 - Long Projects/<Title>/
  <Title>.md                 type: storyline (project hub)
  Scenes/                    type: scene (sequence, act, chapter, status, pov, characters, location)
  Codex/Characters/          type: character
  Codex/Locations/           type: location
  Notes/   Research/   Archive/
[!warning] Gate for 0.4–0.6 StoryLine already has the scene list, inspector, board, corkboard and codex, and it reads the same notes. Build these versions only if StoryLine falls short in real use — write down what's missing in §8 before starting.

Feature	Version
Project panel / scene list: scenes in order with status + word count; drag to reorder (updates sequence); new scene button	0.4
Scene details: edit status, POV, characters, location, notes from a sidebar	0.4
Corkboard: scenes as index cards in story order, grouped by act/chapter	0.5
Kanban: columns by status; drag a card to change status	0.5
Codex: characters & places, with "appears in" scene lists both ways	0.6
Beat sheet templates: scaffold a project from Save the Cat, Three-Act, Hero's Journey, etc.; assign scenes to beats and see empty beats	0.7
Planning: outline per act; unassigned scene ideas parking lot	0.7
Research: research notes linked to scenes/characters	0.8+
Manuscript view: read all scenes as one continuous document	0.8+
Export (Markdown → DOCX/PDF)	Not planned — StoryLine does this
Timeline / plot grid	Not planned — use StoryLine
Reordering rules: sequence uses gaps (10, 20, 30…) so moving one scene usually rewrites one file, not all of them. All frontmatter writes go through processFrontMatter to avoid clobbering edits and limit sync conflicts with the phone.

E. Shared: Codex & worlds
Feature	Version
Characters/places work the same in short and long form (same frontmatter)	0.1
Shared cast: one set of characters/places used by several related stories	0.8+
F. Home & progress
Feature	Version
Home keeps working with Bases + Keep the Rhythm (no rewrite needed)	0.1
Home dashboard ships with Inkwell: built-in Home template (the vault's 00 - Home), "Open Home" command + ribbon, home-page styles moved from the home.css snippet into the plugin	0.3
Plugin adds code blocks for Home: inkwell-inbox, inkwell-in-progress, inkwell-heatmap (KTR heatmap of drafts + scenes only); inkwell-prompt shipped early in 0.2	0.3
Per-story word targets and "words this week on this story" (read from Keep the Rhythm's daily log, drafts/scenes only; see §5)	0.3
Embed Keep the Rhythm's heatmap and totals blocks (ktr-heatmap, ktr-slots) on Home and in the story panel instead of building our own	0.3
Streaks/goals/word log: keep using Keep the Rhythm; Inkwell keeps no word log, streaks or heatmap of its own	—
G. Settings
Feature	Version
Folder locations (defaults match this vault: 00 - Inbox, 01 - Writing, 02 - Long Projects, 04 - Practice, 05 - Resources)	0.1
Template file path for each note type (files live in 99 - System/Templates)	0.1
Status lists for short and long form (long form defaults to StoryLine's scene statuses: idea, outlined, draft, written, revised, final)	0.1
Default word targets	0.3
3. Data model (frontmatter type: values)
type	Where	Key fields
capture	00 - Inbox	kind, created, source
journal	04 - Practice/Journal	created, writing_min
exercise	04 - Practice/Exercises	prompt (link to prompt note), minutes, became (link)
prompt	04 - Practice/Prompts (one note each; Bases table)	tags, used (count), last_used (date)
story	01 - Writing/<Title>	status, logline, genre, target_wordcount, next (next step), from (link to exercise it came from)
draft	01 - Writing/<Title> (snapshots in Archive/)	project, version; snapshots also have snapshot (date)
storyline	02 - Long Projects/<Title>	StoryLine fields (title, bookId, language) + status, logline, target_wordcount, promoted (date)
scene	…/Scenes	StoryLine fields (sequence, act, chapter, status, pov, characters, location, target_wordcount, notes)
character / location	story folder or Codex	name, tagline, role, goal, …
resource	05 - Resources	kind, status, author, url
Existing notes already use most of these, so the plugin can adopt the vault as-is.

Naming decisions

target_wordcount everywhere (StoryLine's name), so promoting short → long needs no renaming.
location, not place. The 99 - System/Templates/Place.md template now writes type: location (changed 2026-11-20). Inkwell still reads place as an alias for any older notes.
Compatibility: StoryLine fields match StoryLine 1.11.12. Re-check §3 when StoryLine updates. Keep the Rhythm reading (§5) is tested against Keep the Rhythm 0.2.16 (data schema 0.2).

4. Roadmap
Version	Theme	Ships	Status
0.1	Foundations	Plugin skeleton, settings (folders/templates/statuses), quick capture → Inbox (desktop + mobile), today's journal, new short story + progress, new exercise + random prompt, prompt notes + Prompts table	planned
0.2	Inbox & practice	Inbox panel with triage actions, append-to-today, prompt of the day, "this became a story"	planned
0.3	Short-form depth	Story panel, revision snapshots, promote short → long, Home code blocks, per-story targets + words this week (via Keep the Rhythm), embedded Keep the Rhythm heatmap/totals	planned
0.4	Long-form core (gated)	Project panel: scene list, drag reorder, new scene, scene details sidebar	planned
0.5	Boards (gated)	Corkboard + kanban for scenes	planned
0.6	Codex (gated)	Characters & places panel with appears-in links (short + long)	planned
0.7	Structure	Beat sheet templates, planning parking lot	planned
0.8+	Grow	Research links, manuscript view, sprints, shared cast, weekly review	planned
Status values: planned → building → shipped.

At each step the vault keeps working without the plugin; Templater/Bases stay until a plugin feature fully replaces them.

5. What stays with other plugins (for now)
Keep the Rhythm: word counts, streaks, heatmap — an optional dependency of Inkwell (see below).
StoryLine: long-form views, timeline, plot grid, manuscript export — Inkwell only rebuilds what proves missing.
Bases: the boards on Home.
Templater: until 0.1 replaces the Story/Exercise/Journal templates.
QuickAdd: replaced for writing capture by Inkwell quick capture in 0.1; keep for any non-writing macros.
Novel Word Count: keeps file-explorer counts; Inkwell computes draft/scene counts itself for progress.
Homepage, Harper, Excalidraw, Folder Notes: unchanged.

Keep the Rhythm integration

Inkwell does not keep its own word log, streaks or heatmap. It reads Keep the Rhythm (KTR) for anything time-based ("words this week", streaks) and embeds KTR's blocks for display.

What Inkwell uses	How	Supported or internal
ktr-heatmap, ktr-slots, ktr-entries code blocks	Embedded in Inkwell's notes and views (journal template already uses ktr-entries)	Supported (user-facing blocks)
Daily log: stats.dailyActivity (date, filePath, wordCountStart, changes[].w)	Read from KTR's data.json to sum words per story per day/week	Internal (undocumented; may change)
Streak totals: stats.currentStreak, stats.highestStreak	Read from KTR's data.json for Home	Internal (undocumented; may change)

Rules
Optional: Inkwell works fully without KTR installed or enabled; KTR-based numbers and blocks are simply hidden.
One file: all KTR code lives in src/integrations/keep-the-rhythm.ts; nothing else reads KTR data.
Read-only: Inkwell never writes KTR's data or settings.
Version check: Inkwell checks KTR's version and data schema; on an untested version it hides KTR stats (with a note in settings) rather than showing wrong numbers.
Drafts and scenes only: per-story numbers count only dailyActivity entries whose filePath is a story draft or scene — journal and exercise writing doesn't count toward a story (matches §8 Progress).

Known risk: device-by-device history. KTR keeps its working history in each device's local IndexedDB and mirrors it into data.json. If phone and desktop each write data.json, the synced copy may hold only one device's history, so "words this week" could undercount. Fallback: if this shows up in real use, swap in Inkwell's own word log (behind the same one-file interface) — recorded in §9 until needed.

After every KTR update: re-check the numbers against KTR's own heatmap/entries for a known day, then bump the tested version in §3.
6. StoryLine features reviewed
StoryLine is MIT-licensed, so Inkwell may reuse its code with attribution (keep StoryLine's copyright and license notice in Inkwell's LICENSE/README).

StoryLine feature	Inkwell
Board, corkboard, scene list, inspector, codex	In plan (0.4–0.6), gated on StoryLine falling short
Beat sheet templates	Added (0.7)
Plotlines, setup/payoff, timeline & story dates, plot grid, plot-hole detection	Not planned — use StoryLine
Scene snapshots, convert note to scene, filters & bulk edit, stats & pacing	Not planned for now (revisit later)
Manuscript view, DOCX/PDF export, Scrivener import	Manuscript view 0.8+; export/import use StoryLine
Series mode, relationship map, story graph, image galleries, custom fields	Not planned
7. Development & release
Source code lives in its own git repo outside this vault (the vault stays writing-only). Only the build output (main.js, manifest.json, styles.css) goes into .obsidian/plugins/inkwell/.
Getting it to the phone: BRAT (decided 2026-11-21). Inkwell's GitHub repo publishes a release per version with main.js, manifest.json and styles.css attached; the tag must equal the manifest version (no "v" prefix). npm version <x.y.z> bumps package.json, manifest.json and versions.json; pushing the tag runs the release workflow, which creates a draft release to review and publish. BRAT on the phone (and desktop) then installs/updates from that repo. Phone testing is deferred for now and doesn't block a release.
Testing: develop against a throwaway test vault with sample notes; only copy a build into this vault once it works there. Test quick capture on the phone every release.
Safety: any command that moves, splits or rewrites notes saves the original to Archive/ or uses Obsidian's trash first.
8. Decisions (2026-11-20)
Name: Inkwell.
Short stories: one hub + one Draft note. Scenes only appear when a story is promoted to long form.
TTRPGs & worlds: not part of the plugin; 03 - TTRPGs & Worlds stays as it is.
Prompts: one note per prompt, viewed and filtered in a Bases table.
Progress: counts draft/scene words only; journal and exercises are tracked separately.
Mobile: quick capture must work on the phone from 0.1.
Submission tracking: not needed; dropped.
Scheduling: the roadmap (§4) is the single source of truth; features carry version numbers, not MVP/Next/Later.
Order: short-form depth (0.3) comes before long-form views; long-form views (0.4–0.6) are gated on StoryLine falling short.
Field names: target_wordcount and type: location everywhere.
2026-11-21 — Distribution: BRAT from GitHub releases (not vault sync). Phone testing deferred for now.
2026-11-21 — Keep the Rhythm: optional dependency. Inkwell keeps no word log, streaks or heatmap of its own; it reads KTR's daily log and embeds its blocks (§5).
9. Ideas / parking lot
New ideas go here first; move them into §2 with a version once decided.
Inkwell's own word log — only if KTR's device-by-device history proves unreliable (§5).
StoryLine gaps (evidence for 0.4–0.6)
10. Changelog
Date	Version	Change
2026-11-20	—	Plan reviewed: versions replace MVP/Next/Later, roadmap reordered (short form before long form), data-model names fixed, dev & release section added.
2026-11-21	—	Keep the Rhythm made an optional dependency: §2F words-this-week reads KTR's daily log and a new 0.3 item embeds its heatmap/totals; §3 notes KTR 0.2.16 compatibility; §5 adds the integration table, rules and device-history risk; §8 records the decision. Also logged: Place template now writes type: location (2026-11-20).
2026-11-21	—	Distribution decided: BRAT from GitHub releases (§7, §8); phone testing deferred.
2026-11-21	0.3	Built 0.3 (story panel, revision snapshots, promote short → long, Home blocks, KTR words-this-week and heatmap). §3 gains story next/from, draft snapshot, storyline promoted; long-form statuses default to StoryLine's; inkwell-prompt block moved to 0.2.
2026-11-21	0.3	Home dashboard added to Inkwell: built-in Home template (identical to 00 - Home with default folders), Open Home command, home.css styles bundled in the plugin.
2026-11-21	0.3	Home template uses Inkwell blocks: inkwell-in-progress (pick up where you left off), inkwell-inbox (Inbox column), inkwell-prompt (Practice column); Practice list excludes prompts; "New…" picker command for ⌘⇧N.
2026-11-21	0.3	Home: Inbox and Practice are full-width rows instead of two columns.
2026-11-21	0.3	Home: "Learning from" is an inline base (resources with status in-progress) instead of embedding Resources.base, so Home works in any vault.
