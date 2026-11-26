import { moment, normalizePath, Notice, TFile, TFolder } from "obsidian";
import type InkwellPlugin from "./main";
import { askForm, pick } from "./modals";
import { loadTemplate, render } from "./templates";
import { cleanName, createNote, ensureFolder, uniquePath, fmOf, fmStr } from "./util";
import { countWords } from "./wordcount";
import { emptyBlock } from "./writingblocks";

/** Sub-folders every project gets (StoryLine-compatible layout). */
export const PROJECT_FOLDERS = ["Scenes", "Codex/Characters", "Codex/Locations", "Notes", "Research", "Archive"];

export interface LongProject {
  name: string;
  folder: TFolder;
  hub: TFile | null;
  scenes: TFile[];
}


/** Read a project folder. Returns null if it has no project note (type: storyline). */
export function projectFromFolder(plugin: InkwellPlugin, f: TFolder): LongProject | null {
  const files = f.children.filter((c): c is TFile => c instanceof TFile && c.extension === "md");
  const hub = files.find((c) => fmOf(plugin.app, c)?.type === "storyline") ?? null;
  if (!hub) return null;
  const scenesFolder = plugin.app.vault.getAbstractFileByPath(`${f.path}/Scenes`);
  const scenes =
    scenesFolder instanceof TFolder
      ? scenesFolder.children.filter(
          (c): c is TFile => c instanceof TFile && c.extension === "md" && fmOf(plugin.app, c)?.type === "scene"
        )
      : [];
  const seq = (s: TFile) => Number(fmOf(plugin.app, s)?.sequence) || 0;
  scenes.sort((a, b) => seq(a) - seq(b) || a.name.localeCompare(b.name));
  return { name: f.name, folder: f, hub, scenes };
}

export function listLongProjects(plugin: InkwellPlugin): LongProject[] {
  const root = plugin.app.vault.getAbstractFileByPath(normalizePath(plugin.settings.folders.longProjects));
  if (!(root instanceof TFolder)) return [];
  const out: LongProject[] = [];
  for (const f of root.children) {
    if (!(f instanceof TFolder)) continue;
    const p = projectFromFolder(plugin, f);
    if (p) out.push(p);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** The project a file belongs to, if it sits inside a project folder. */
export function projectForFile(plugin: InkwellPlugin, file: TFile | null): LongProject | null {
  if (!file) return null;
  const root = normalizePath(plugin.settings.folders.longProjects);
  if (!file.path.startsWith(root + "/")) return null;
  const name = file.path.slice(root.length + 1).split("/")[0];
  const folder = plugin.app.vault.getAbstractFileByPath(`${root}/${name}`);
  return folder instanceof TFolder ? projectFromFolder(plugin, folder) : null;
}

export async function projectWords(plugin: InkwellPlugin, p: LongProject): Promise<number> {
  let n = 0;
  for (const s of p.scenes) n += countWords(await plugin.app.vault.cachedRead(s));
  return n;
}

export interface ProjectProgress {
  status: string;
  words: number;
  target: number;
  lastWorked: number | null;
}

export async function projectProgress(plugin: InkwellPlugin, p: LongProject): Promise<ProjectProgress> {
  const fm = p.hub ? fmOf(plugin.app, p.hub) : undefined;
  return {
    status: fmStr(fm?.status),
    words: await projectWords(plugin, p),
    target: Number(fm?.target_wordcount) || 0,
    lastWorked: p.scenes.length ? Math.max(...p.scenes.map((f) => f.stat.mtime)) : null,
  };
}

export interface ProjectInput {
  title: string;
  logline: string;
  genre: string;
  target: number;
}

export async function askProjectDetails(
  plugin: InkwellPlugin,
  prefill: Partial<ProjectInput> = {},
  heading = "New project"
): Promise<ProjectInput | null> {
  const target = prefill.target ?? plugin.settings.defaultLongTarget;
  const v = await askForm(plugin.app, heading, [
    { key: "title", label: "Title", required: true, value: prefill.title ?? "" },
    { key: "logline", label: "Logline", placeholder: "optional", value: prefill.logline ?? "" },
    { key: "genre", label: "Genre", placeholder: "optional", value: prefill.genre ?? "" },
    { key: "target", label: "Target words", type: "number", value: target ? String(target) : "" },
  ]);
  if (!v) return null;
  const title = cleanName(v.title);
  if (!title) return null;
  return { title, logline: v.logline, genre: v.genre, target: parseInt(v.target, 10) || 0 };
}

/** Build the project layout. Returns null if the folder already exists. */
export async function createProject(
  plugin: InkwellPlugin,
  input: ProjectInput,
  opts: { hubFields?: Record<string, unknown>; open?: boolean } = {}
): Promise<LongProject | null> {
  const { app, settings } = plugin;
  const { title } = input;
  const dest = normalizePath(`${settings.folders.longProjects}/${title}`);
  if (app.vault.getAbstractFileByPath(dest)) {
    new Notice(`A project folder named "${title}" already exists.`);
    return null;
  }
  for (const sub of PROJECT_FOLDERS) await ensureFolder(app, `${dest}/${sub}`);

  const date = moment().format("YYYY-MM-DD");
  const fields: Record<string, unknown> = {
    type: "storyline",
    title,
    bookId: crypto.randomUUID(),
    language: "en",
    status: settings.shortStatuses[0] ?? "idea",
    logline: input.logline,
    genre: input.genre,
    created: date,
    ...opts.hubFields,
  };
  if (input.target > 0) fields.target_wordcount = input.target;

  const tpl = await loadTemplate(app, settings, "projectHub");
  const hub = await createNote(app, `${dest}/${title}.md`, render(tpl, { title, logline: input.logline, genre: input.genre, date }), fields);
  if (opts.open !== false) await app.workspace.getLeaf(false).openFile(hub);
  const projectFolder = app.vault.getFolderByPath(dest);
  if (!projectFolder) throw new Error(`Project folder "${dest}" was not created`);
  return projectFromFolder(plugin, projectFolder);
}

/** New project from scratch: project note plus the full folder layout. */
export async function newProject(plugin: InkwellPlugin): Promise<void> {
  const input = await askProjectDetails(plugin);
  if (input && (await createProject(plugin, input))) new Notice(`Project "${input.title}" created.`);
}

/** StoryLine's scene file name: "<act>-<sequence> <title>". */
export function sceneFileName(seq: number, title: string): string {
  const t = title.replace(/[\\/:*?"<>|]/g, "-").substring(0, 60);
  return `00-${String(seq).padStart(2, "0")} ${t}`;
}

/** Create a scene at the end of a project. Sequence numbers use gaps of 10. */
export async function createScene(
  plugin: InkwellPlugin,
  project: LongProject,
  title: string,
  opts: { body?: string; status?: string; fields?: Record<string, unknown>; open?: boolean } = {}
): Promise<TFile> {
  const { app, settings } = plugin;
  const last = Math.max(0, ...project.scenes.map((s) => Number(fmOf(plugin.app, s)?.sequence) || 0));
  const seq = Math.floor(last / 10) * 10 + 10;
  const fields: Record<string, unknown> = {
    type: "scene",
    id: crypto.randomUUID(),
    title,
    sequence: seq,
    status: opts.status ?? settings.longStatuses[0] ?? "idea",
    characters: [],
    location: "",
    created: moment().format("YYYY-MM-DD"),
    ...opts.fields,
  };
  if (settings.defaultSceneTarget) fields.target_wordcount = settings.defaultSceneTarget;
  const file = await createNote(
    app,
    uniquePath(app, `${project.folder.path}/Scenes`, sceneFileName(seq, title)),
    // A new scene starts with a writing block, so its writing counts (spec writing-blocks).
    opts.body ? opts.body.trim() + "\n" : emptyBlock().join("\n") + "\n",
    fields
  );
  project.scenes.push(file);
  if (opts.open !== false) await app.workspace.getLeaf(false).openFile(file);
  return file;
}

/** "New scene": in the current project, or a chosen one. */
export async function newScene(plugin: InkwellPlugin, project?: LongProject | null): Promise<void> {
  project = project ?? projectForFile(plugin, plugin.app.workspace.getActiveFile());
  if (!project) {
    const all = listLongProjects(plugin);
    if (!all.length) {
      new Notice("No projects yet. Create a project first.");
      return;
    }
    project = await pick(plugin.app, all, (p) => p.name, "Which project?");
    if (!project) return;
  }
  const v = await askForm(plugin.app, `New scene in ${project.name}`, [{ key: "title", label: "Scene title", required: true }]);
  const title = v ? cleanName(v.title) : "";
  if (title) await createScene(plugin, project, title);
}
