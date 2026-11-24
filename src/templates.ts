import { App, normalizePath, Notice, TFile } from "obsidian";
import { ensureFolder } from "./util";
import type { InkwellSettings } from "./settings";

export type TemplateKey = keyof InkwellSettings["templates"];

/** Home dashboard. {{practice}} comes from the folder settings. */
const HOME_TEMPLATE = `---
aliases:
  - Home
cssclasses:
  - home-page
---
# ✍️ Write Something Today

> [!moves]
> - **⌘N** Capture an idea
> - **⌘⇧D** Today's journal
> - **⌘⇧N** New story, exercise…
> - **Ribbon** Inbox · Story panel · StoryLine
> - **⌘P** Everything else

\`\`\`ktr-heatmap
OPTIONS
WEEKS 48
COLORING_MODE liquid
STOPS 100, 500, 1000
CENTER
\`\`\`

\`\`\`ktr-slots
CURRENT_DAY, WORDS
CURRENT_STREAK
CURRENT_WEEK, WORDS
CURRENT_MONTH, WORDS, AVG
\`\`\`

## ▶ Pick Up Where You Left Off
\`\`\`inkwell-in-progress
title: none
\`\`\`

> [!inbox] 📥 Inbox (to sort)
> \`\`\`inkwell-inbox
> title: none
> limit: 7
> \`\`\`

> [!practice] 📓 Practice
> \`\`\`inkwell-practice
> title: none
> \`\`\`
> \`\`\`inkwell-prompt
> \`\`\`
> \`\`\`base
> filters:
>   and:
>     - file.inFolder("{{practice}}")
>     - file.ext == "md"
>     - type != "prompt"
> views:
>   - type: list
>     name: Practice
>     order:
>       - file.name
>       - note.type
>     sort:
>       - property: file.mtime
>         direction: DESC
>     limit: 7
> \`\`\`

## 🌱 Your Contribution
\`\`\`inkwell-contribution
title: none
\`\`\`

## 📚 Learning From
\`\`\`base
filters:
  and:
    - type == "resource"
    - status == "in-progress"
views:
  - type: table
    name: In progress
    order:
      - file.name
      - kind
      - author
\`\`\`

> [!footer]
> 🗂 Boards: [[Writing.base|Writing]] · [[Practice.base|Practice]] · [[Resources.base|Resources]] · [[Prompts.base|Prompts]]  ·  📖 [[How this vault works]]
`;

/**
 * Built-in templates. Placeholders: {{name}} is replaced with the value passed
 * in, or left empty. Frontmatter here holds optional extras only — Inkwell sets
 * the required fields (type, status, project…) itself after creating the note.
 */
export const BUILTIN_TEMPLATES: Record<TemplateKey, string> = {
  home: HOME_TEMPLATE,
  journal: `---
type: journal
writing_min:
---
{{prompt_of_the_day}}
## Daily Goals
- 

## Ideas, Observations, Reflections


## Words Written
\`\`\`ktr-entries
{{date}}
\`\`\`
`,
  exercise: `---
type: exercise
tags:
---
## Prompt
{{prompt_text}}

## Goal


## Work


## Reflection
`,
  drill: `---
type: drill
tags:
skill:
minutes: 10
---
## How to Do It
1. 

## Variations
- 

## Why It Works

`,
  storyHub: `---
type: story
tags:
---
## Logline
{{logline}}

## Premise


## Outline
1. 

## Draft
→ [[{{title}} - Draft]]

---
## Project Files
\`\`\`base
filters:
  and:
    - file.folder == this.file.folder
    - file.name != this.file.name
views:
  - type: table
    name: In this project
    order:
      - file.name
      - type
      - file.mtime
\`\`\`
`,
  storyDraft: `---
type: draft
---

`,
  projectHub: `---
type: storyline
tags:
---
## Logline
{{logline}}

## Premise


## Outline
### Act 1

### Act 2

### Act 3


## Parking Lot
- 

---
## Scenes
\`\`\`base
filters:
  and:
    - file.inFolder(this.file.folder + "/Scenes")
    - type == "scene"
views:
  - type: table
    name: Scenes
    order:
      - file.name
      - status
      - pov
      - target_wordcount
    sort:
      - property: sequence
        direction: ASC
\`\`\`
`,
  character: `---
type: character
tags:
---
## {{title}}
{{tagline}}

---
## Attributes
### Physical Description
### Personality
### Occupation
### Habits / Mannerisms

---
## Story
### Background
### Goal
### Internal Conflicts
### External Conflicts

---
## Notes
`,
  location: `---
type: location
tags:
---
## {{title}}

### What It Looks, Sounds, Smells Like
### Who Lives / Works Here
### History
### Why It Matters to the Story

---
## Notes
`,
};

export const TEMPLATE_FILE_NAMES: Record<TemplateKey, string> = {
  home: "Home",
  journal: "Journal",
  exercise: "Exercise",
  drill: "Drill",
  storyHub: "Story",
  storyDraft: "Story Draft",
  projectHub: "Project",
  character: "Character",
  location: "Location",
};

export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

/** Template text from the configured file, falling back to the built-in. */
export async function loadTemplate(app: App, settings: InkwellSettings, key: TemplateKey): Promise<string> {
  const path = settings.templates[key];
  if (path) {
    const p = normalizePath(path.endsWith(".md") ? path : `${path}.md`);
    const file = app.vault.getAbstractFileByPath(p);
    if (file instanceof TFile) return app.vault.read(file);
  }
  return BUILTIN_TEMPLATES[key];
}

/** Write the built-in templates to the configured paths. Never overwrites. */
export async function writeDefaultTemplates(app: App, settings: InkwellSettings): Promise<void> {
  let written = 0;
  for (const key of Object.keys(BUILTIN_TEMPLATES) as TemplateKey[]) {
    const path = settings.templates[key];
    if (!path) continue;
    const p = normalizePath(path.endsWith(".md") ? path : `${path}.md`);
    if (app.vault.getAbstractFileByPath(p)) continue;
    await ensureFolder(app, p.split("/").slice(0, -1).join("/"));
    await app.vault.create(p, BUILTIN_TEMPLATES[key]);
    written++;
  }
  new Notice(written ? `Inkwell: wrote ${written} template(s).` : "Inkwell: all templates already exist.");
}
