import { moment, Notice, TFile, TFolder } from "obsidian";
import type InkwellPlugin from "./main";
import type { Story } from "./stories";
import { createNote, uniquePath, fmOf, type Frontmatter, fmStr } from "./util";
import { countWords } from "./wordcount";

export interface Revision {
  file: TFile;
  version: number;
  words: number;
  date: string;
}

/** Save the current draft as "<Draft> vN" in Archive/ and bump the working draft to vN+1.
 *  The working draft keeps its name, so links and its word log history stay attached. */
export async function snapshotDraft(plugin: InkwellPlugin, story: Story): Promise<void> {
  const { app } = plugin;
  const draft = story.draft;
  if (!draft) {
    new Notice("This story has no draft yet.");
    return;
  }
  const v = Number(fmOf(app, draft)?.version) || 1;
  const path = uniquePath(app, `${story.folder.path}/Archive`, `${draft.basename} v${v}`);
  const text = await app.vault.read(draft);
  await createNote(app, path, text, { version: v, snapshot: moment().format("YYYY-MM-DD") });
  await app.fileManager.processFrontMatter(draft, (fm: Frontmatter) => (fm.version = v + 1));
  new Notice(`Saved v${v} to Archive — now on v${v + 1}`);
}

/** Archived snapshots of this story's draft, oldest first. */
export async function listRevisions(plugin: InkwellPlugin, story: Story): Promise<Revision[]> {
  const { app } = plugin;
  const archive = app.vault.getAbstractFileByPath(`${story.folder.path}/Archive`);
  if (!(archive instanceof TFolder)) return [];
  const out: Revision[] = [];
  for (const f of archive.children) {
    if (!(f instanceof TFile) || f.extension !== "md") continue;
    const fm = fmOf(app, f);
    if (fm?.type !== "draft" || !fm?.snapshot) continue;
    out.push({
      file: f,
      version: Number(fm.version) || 0,
      words: countWords(await app.vault.cachedRead(f)),
      date: fmStr(fm.snapshot),
    });
  }
  return out.sort((a, b) => a.version - b.version);
}
