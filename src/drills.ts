import { moment, normalizePath, Notice, TFile, TFolder } from "obsidian";
import type InkwellPlugin from "./main";
import { askForm, pick } from "./modals";
import { loadTemplate, render } from "./templates";
import { cleanName, createNote, ensureFolder, fmOf, fmStr, uniquePath } from "./util";

export interface Drill {
  file: TFile;
  skill: string;
  minutes: number;
}

/** Drill notes in the drills folder (subfolders included). Notes without a type count too. */
export function listDrills(plugin: InkwellPlugin): Drill[] {
  const { app } = plugin;
  const folder = app.vault.getAbstractFileByPath(normalizePath(plugin.settings.folders.drills));
  if (!(folder instanceof TFolder)) return [];
  const out: Drill[] = [];
  const walk = (f: TFolder) => {
    for (const c of f.children) {
      if (c instanceof TFolder) walk(c);
      else if (c instanceof TFile && c.extension === "md") {
        const fm = fmOf(app, c);
        if (fm?.type && fm.type !== "drill") continue;
        out.push({ file: c, skill: fmStr(fm?.skill), minutes: Number(fm?.minutes) || 0 });
      }
    }
  };
  walk(folder);
  return out.sort((a, b) => a.file.basename.localeCompare(b.file.basename));
}

export function drillFor(plugin: InkwellPlugin, file: TFile | null): Drill | null {
  if (!file || fmOf(plugin.app, file)?.type !== "drill") return null;
  return listDrills(plugin).find((d) => d.file.path === file.path) ?? null;
}

/** Ask for a drill (the active note if it is one), for starting an exercise. */
export async function pickDrill(plugin: InkwellPlugin): Promise<Drill | null> {
  const active = drillFor(plugin, plugin.app.workspace.getActiveFile());
  if (active) return active;
  const drills = listDrills(plugin);
  if (!drills.length) {
    new Notice(`No drills yet in "${plugin.settings.folders.drills}". Use "Inkwell: New drill" or "Inkwell: Add starter drills".`);
    return null;
  }
  return pick(plugin.app, drills, (d) => (d.skill ? `${d.file.basename} · ${d.skill}` : d.file.basename), "Pick a drill");
}

export async function newDrill(plugin: InkwellPlugin): Promise<void> {
  const { app, settings } = plugin;
  const v = await askForm(app, "New drill", [
    { key: "name", label: "Name", required: true },
    { key: "skill", label: "Skill it trains", placeholder: "optional" },
    { key: "minutes", label: "Suggested minutes", type: "number", value: String(settings.exerciseMinutes) },
    { key: "tags", label: "Tags", placeholder: "comma-separated, optional" },
  ]);
  if (!v) return;
  const name = cleanName(v.name) || "Drill";
  const date = moment().format("YYYY-MM-DD");
  const tpl = await loadTemplate(app, settings, "drill");
  const file = await createNote(app, uniquePath(app, settings.folders.drills, name), render(tpl, { title: name, date }), {
    type: "drill",
    tags: splitTags(v.tags),
    skill: v.skill.trim(),
    minutes: parseInt(v.minutes, 10) || null,
    created: date,
  });
  await app.workspace.getLeaf(false).openFile(file);
}

/** Add the starter drills to the drills folder. Skips any whose note already exists. */
export async function addStarterDrills(plugin: InkwellPlugin): Promise<void> {
  const { app, settings } = plugin;
  const folder = normalizePath(settings.folders.drills);
  await ensureFolder(app, folder);
  const date = moment().format("YYYY-MM-DD");
  let added = 0;
  for (const d of STARTER_DRILLS) {
    const path = `${folder}/${d.name}.md`;
    if (app.vault.getAbstractFileByPath(path)) continue;
    await createNote(app, path, d.body, { type: "drill", tags: d.tags, skill: d.skill, minutes: d.minutes, created: date });
    added++;
  }
  new Notice(added ? `Inkwell: added ${added} starter drill(s).` : "Inkwell: the starter drills are already there.");
}

function splitTags(s: string): string[] {
  return s.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean);
}

const STARTER_DRILLS: { name: string; tags: string[]; skill: string; minutes: number; body: string }[] = [
  {
    name: "Freewrite",
    tags: ["starter", "fluency"],
    skill: "Getting words down without judging them",
    minutes: 10,
    body: `## How to Do It
1. Set a timer.
2. Write without stopping until it ends. Don't reread, cross out, or fix spelling.
3. If you get stuck, write "I don't know what to write" until something else comes.
4. When the timer ends, underline one line worth keeping.

## Variations
- Start from a single word or the last thing you heard someone say.
- Loop: take the underlined line and freewrite again from it.

## Why It Works
It separates drafting from editing. Turning off the inner critic for ten minutes builds speed and shows you what's on your mind.
`,
  },
  {
    name: "Five senses",
    tags: ["starter", "description"],
    skill: "Concrete sensory detail",
    minutes: 10,
    body: `## How to Do It
1. Pick one place or object you can observe right now, or remember well.
2. Write one paragraph for each sense: sight, sound, smell, touch, taste.
3. Use no abstract words (beautiful, nice, strange). Name the specific thing.
4. Cut the paragraphs down to the three strongest details.

## Variations
- Skip sight entirely.
- Describe the same place at two different times of day.

## Why It Works
Most drafts lean on sight. Forcing the other senses makes a setting feel physical and trains you to choose the detail that does the most work.
`,
  },
  {
    name: "Copywork and imitation",
    tags: ["starter", "style"],
    skill: "Sentence rhythm and structure",
    minutes: 15,
    body: `## How to Do It
1. Choose a paragraph you admire from a book.
2. Copy it out word for word, by hand if you can.
3. Write a new paragraph on a different subject that keeps the original's structure: same number of sentences, similar lengths, same moves.
4. Note one thing the author does that you don't usually do.

## Variations
- Imitate a writer whose style is very unlike yours.
- Imitate only the dialogue tags and paragraph breaks.

## Why It Works
Copying slows you down enough to notice choices you skim past when reading. Imitation lets you borrow a technique before it's yours.
`,
  },
  {
    name: "Dialogue only",
    tags: ["starter", "dialogue"],
    skill: "Character and subtext through speech",
    minutes: 10,
    body: `## How to Do It
1. Pick two characters who want different things.
2. Write their conversation as dialogue only: no tags, no action, no description.
3. Neither of them may say directly what they want.
4. Reread it. Can you tell who is speaking from voice alone?

## Variations
- Write down a real conversation you overheard, then rewrite it as fiction.
- One character only answers in questions.

## Why It Works
Without tags and action, every line has to carry voice, tension, and subtext on its own.
`,
  },
  {
    name: "Point of view switch",
    tags: ["starter", "point-of-view"],
    skill: "Choosing and controlling point of view",
    minutes: 15,
    body: `## How to Do It
1. Write a short scene (about 200 words) in first person.
2. Rewrite it in close third person.
3. Rewrite it once more from another character in the scene.
4. Note what each version can show that the others can't.

## Variations
- Switch tense instead: past to present.
- Rewrite in second person.

## Why It Works
Point of view decides what the reader knows and feels. Seeing one scene three ways makes the choice deliberate instead of a default.
`,
  },
];
