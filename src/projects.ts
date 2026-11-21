import { normalizePath, TFile, TFolder } from "obsidian";
import type InkwellPlugin from "./main";
import { countWords } from "./wordcount";

export interface LongProject {
  name: string;
  folder: TFolder;
  hub: TFile | null;
  scenes: TFile[];
}

export function listLongProjects(plugin: InkwellPlugin): LongProject[] {
  const { app } = plugin;
  const root = app.vault.getAbstractFileByPath(normalizePath(plugin.settings.folders.longProjects));
  if (!(root instanceof TFolder)) return [];
  const out: LongProject[] = [];
  for (const f of root.children) {
    if (!(f instanceof TFolder)) continue;
    const files = f.children.filter((c): c is TFile => c instanceof TFile && c.extension === "md");
    const hub = files.find((c) => app.metadataCache.getFileCache(c)?.frontmatter?.type === "storyline") ?? null;
    if (!hub) continue;
    const scenesFolder = app.vault.getAbstractFileByPath(`${f.path}/Scenes`);
    const scenes =
      scenesFolder instanceof TFolder
        ? scenesFolder.children.filter(
            (c): c is TFile =>
              c instanceof TFile && c.extension === "md" && app.metadataCache.getFileCache(c)?.frontmatter?.type === "scene"
          )
        : [];
    out.push({ name: f.name, folder: f, hub, scenes });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function projectWords(plugin: InkwellPlugin, p: LongProject): Promise<number> {
  let n = 0;
  for (const s of p.scenes) n += countWords(await plugin.app.vault.cachedRead(s));
  return n;
}
