import { App, normalizePath, Notice, TFile } from "obsidian";
import { ensureFolder } from "./util";
import type { InkwellSettings } from "./settings";

export type TemplateKey = keyof InkwellSettings["templates"];

/**
 * Built-in templates. Placeholders: {{name}} is replaced with the value passed
 * in, or left empty. Frontmatter here holds optional extras only — Inkwell sets
 * the required fields (type, status, project…) itself after creating the note.
 */
export const BUILTIN_TEMPLATES: Record<TemplateKey, string> = {
  journal: `---
type: journal
---
{{prompt_block}}## Today I wrote
- 

## Ideas, observations, scraps


## Words written today
\`\`\`ktr-entries
{{date}}
\`\`\`
`,
  exercise: `---
type: exercise
tags:
---
## Prompt / goal
{{prompt_text}}

## Work


## What I noticed
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
## Project files
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
  character: `---
type: character
tags:
---
## {{title}}
{{tagline}}

---
## Attributes
### Physical description
### Personality
### Occupation
### Habits / mannerisms

---
## Story
### Background
### Goal
### Internal conflicts
### External conflicts

---
## Notes
`,
  location: `---
type: location
tags:
---
## {{title}}

### What it looks, sounds, smells like
### Who lives / works here
### History
### Why it matters to the story

---
## Notes
`,
};

export const TEMPLATE_FILE_NAMES: Record<TemplateKey, string> = {
  journal: "Journal",
  exercise: "Exercise",
  storyHub: "Story",
  storyDraft: "Story Draft",
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
