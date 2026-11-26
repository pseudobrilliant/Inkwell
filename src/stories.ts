import { App, Modal, moment, Notice, normalizePath, Setting, TFile, TFolder } from "obsidian";
import type InkwellPlugin from "./main";
import { askForm, pick } from "./modals";
import { loadTemplate, render } from "./templates";
import { cleanName, createNote, ensureFolder, uniquePath, fmOf, type Frontmatter, fmStr } from "./util";
import { countWords } from "./wordcount";
import { putInBlock } from "./writingblocks";
import { listLongProjects, LongProject, projectForFile } from "./projects";

export interface Story {
  name: string;
  folder: TFolder;
  hub: TFile | null;
  draft: TFile | null;
}

function typeOf(app: App, f: TFile): string | undefined {
  return fmStr(fmOf(app, f)?.type) || undefined;
}

/** All short-story folders under the writing root. */
export function listStories(plugin: InkwellPlugin): Story[] {
  const root = plugin.app.vault.getAbstractFileByPath(normalizePath(plugin.settings.folders.writing));
  if (!(root instanceof TFolder)) return [];
  return root.children
    .filter((c): c is TFolder => c instanceof TFolder)
    .map((f) => storyFromFolder(plugin, f))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function storyFromFolder(plugin: InkwellPlugin, folder: TFolder): Story {
  const { app } = plugin;
  const files = folder.children.filter((c): c is TFile => c instanceof TFile && c.extension === "md");
  const hub =
    files.find((f) => typeOf(app, f) === "story") ?? files.find((f) => f.basename === folder.name) ?? null;
  const drafts = files.filter((f) => typeOf(app, f) === "draft");
  const version = (f: TFile) => Number(fmOf(app, f)?.version) || 1;
  const draft =
    drafts.sort((a, b) => version(b) - version(a))[0] ??
    files.find((f) => f.basename === `${folder.name} - Draft`) ??
    null;
  return { name: folder.name, folder, hub, draft };
}

/** The story a file belongs to, if it sits inside a short-story folder. */
export function storyForFile(plugin: InkwellPlugin, file: TFile | null): Story | null {
  if (!file) return null;
  const root = normalizePath(plugin.settings.folders.writing);
  if (!file.path.startsWith(root + "/")) return null;
  const name = file.path.slice(root.length + 1).split("/")[0];
  const folder = plugin.app.vault.getAbstractFileByPath(`${root}/${name}`);
  return folder instanceof TFolder ? storyFromFolder(plugin, folder) : null;
}

export interface StoryInput {
  title: string;
  logline: string;
  genre: string;
  target: number;
}

export async function askStoryDetails(
  plugin: InkwellPlugin,
  prefill: Partial<StoryInput> = {},
  heading = "New short story"
): Promise<StoryInput | null> {
  const target = prefill.target ?? plugin.settings.defaultShortTarget;
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

/** Build the short-story layout. Returns null if the folder already exists. */
export async function createShortStory(
  plugin: InkwellPlugin,
  input: StoryInput,
  opts: { draftWriting?: string; hubFields?: Record<string, unknown>; open?: boolean } = {}
): Promise<Story | null> {
  const { app, settings } = plugin;
  const { title } = input;
  const folder = normalizePath(`${settings.folders.writing}/${title}`);
  if (app.vault.getAbstractFileByPath(folder)) {
    new Notice(`A story folder named "${title}" already exists.`);
    return null;
  }
  await ensureFolder(app, folder);
  const vars = { title, logline: input.logline, genre: input.genre, date: moment().format("YYYY-MM-DD") };

  const hubFields: Record<string, unknown> = {
    type: "story",
    status: settings.shortStatuses[0] ?? "idea",
    logline: input.logline,
    genre: input.genre,
    created: vars.date,
    ...opts.hubFields,
  };
  if (input.target > 0) hubFields.target_wordcount = input.target;

  const hub = await createNote(app, `${folder}/${title}.md`, render(await loadTemplate(app, settings, "storyHub"), vars), hubFields);
  let draftText = render(await loadTemplate(app, settings, "storyDraft"), vars);
  // Writing carried up from an exercise goes in the draft's writing block, so it keeps counting (spec writing-blocks).
  if (opts.draftWriting) draftText = putInBlock(draftText, opts.draftWriting.trim());
  const draft = await createNote(app, `${folder}/${title} - Draft.md`, draftText, {
    type: "draft",
    project: `[[${title}]]`,
    version: 1,
  });
  if (opts.open !== false) await app.workspace.getLeaf(false).openFile(hub);
  const f = app.vault.getFolderByPath(folder);
  if (!f) throw new Error(`Story folder "${folder}" was not created`);
  return { name: title, folder: f, hub, draft };
}

export async function newShortStory(plugin: InkwellPlugin): Promise<void> {
  const input = await askStoryDetails(plugin);
  if (input) await createShortStory(plugin, input);
}

export interface Progress {
  status: string;
  words: number;
  target: number;
  lastWorked: number | null;
}

export async function storyProgress(plugin: InkwellPlugin, story: Story): Promise<Progress> {
  const fm = story.hub ? fmOf(plugin.app, story.hub) : undefined;
  const words = story.draft ? countWords(await plugin.app.vault.cachedRead(story.draft)) : 0;
  return {
    status: fmStr(fm?.status),
    words,
    target: Number(fm?.target_wordcount) || 0,
    lastWorked: story.draft?.stat.mtime ?? null,
  };
}

export function formatProgress(p: Progress): string {
  const words = p.words.toLocaleString();
  return p.target ? `${words} / ${p.target.toLocaleString()} words` : `${words} words`;
}

export class ProgressModal extends Modal {
  constructor(private plugin: InkwellPlugin, private story: Story, private p: Progress) {
    super(plugin.app);
  }
  onOpen() {
    const { contentEl, story, p, plugin } = this;
    this.setTitle(story.name);
    if (p.target) {
      const bar = contentEl.createEl("progress", { cls: "inkwell-progress" });
      bar.max = p.target;
      bar.value = Math.min(p.words, p.target);
    }
    new Setting(contentEl).setName("Draft").setDesc(formatProgress(p) + (p.target ? ` (${Math.round((p.words / p.target) * 100)}%)` : ""));
    new Setting(contentEl)
      .setName("Last worked on")
      .setDesc(p.lastWorked ? moment(p.lastWorked).fromNow() : "No draft yet");
    if (story.hub) {
      const hub = story.hub;
      const statuses = [...plugin.settings.shortStatuses];
      if (p.status && !statuses.includes(p.status)) statuses.unshift(p.status);
      new Setting(contentEl).setName("Status").addDropdown((d) => {
        statuses.forEach((s) => d.addOption(s, s));
        d.setValue(p.status || (statuses[0] ?? ""));
        d.onChange(async (s) => {
          await plugin.app.fileManager.processFrontMatter(hub, (fm: Frontmatter) => (fm.status = s));
          void plugin.refreshStatusBar();
        });
      });
    }
    const buttons = new Setting(contentEl);
    if (story.draft) {
      const draft = story.draft;
      buttons.addButton((b) =>
        b.setButtonText("Open draft").setCta().onClick(() => {
          this.close();
          void plugin.app.workspace.getLeaf(false).openFile(draft);
        })
      );
    }
    if (story.hub) {
      const hub = story.hub;
      buttons.addButton((b) =>
        b.setButtonText("Open hub").onClick(() => {
          this.close();
          void plugin.app.workspace.getLeaf(false).openFile(hub);
        })
      );
    }
  }
  onClose() {
    this.contentEl.empty();
  }
}

export async function showStoryProgress(plugin: InkwellPlugin): Promise<void> {
  let story = storyForFile(plugin, plugin.app.workspace.getActiveFile());
  if (!story) {
    story = await pick(plugin.app, listStories(plugin), (s) => s.name, "Which story?");
    if (!story) return;
  }
  new ProgressModal(plugin, story, await storyProgress(plugin, story)).open();
}

interface CodexHome {
  name: string;
  folder: string | null;
  link: string;
}

/** Where a character/location goes: a story folder, or a project's Codex/ sub-folder. */
function codexHomeForFile(plugin: InkwellPlugin, file: TFile | null, kind: "character" | "location"): CodexHome | null {
  const story = storyForFile(plugin, file);
  if (story) return { name: story.name, folder: story.folder.path, link: `[[${story.hub?.basename ?? story.name}]]` };
  const project = projectForFile(plugin, file);
  if (project) return projectCodexHome(project, kind);
  return null;
}

function projectCodexHome(project: LongProject, kind: "character" | "location"): CodexHome {
  return {
    name: project.name,
    folder: `${project.folder.path}/Codex/${kind === "character" ? "Characters" : "Locations"}`,
    link: `[[${project.hub?.basename ?? project.name}]]`,
  };
}

/** New character or location: in the current story or project, or a chosen one. */
export async function newCodexNote(
  plugin: InkwellPlugin,
  kind: "character" | "location",
  forFile: TFile | null = plugin.app.workspace.getActiveFile()
): Promise<void> {
  const { app, settings } = plugin;
  const v = await askForm(app, kind === "character" ? "New character" : "New location", [
    { key: "name" as const, label: "Name", required: true },
    ...(kind === "character" ? [{ key: "tagline" as const, label: "Tagline", placeholder: "one line, optional" }] : []),
  ]);
  if (!v) return;
  const name = cleanName(v.name);
  if (!name) return;

  let home = codexHomeForFile(plugin, forFile, kind);
  if (!home) {
    const choices: CodexHome[] = [
      { name: "(None — Inbox)", folder: null, link: "" },
      ...listStories(plugin).map((s) => ({ name: `${s.name} (story)`, folder: s.folder.path, link: `[[${s.hub?.basename ?? s.name}]]` })),
      ...listLongProjects(plugin).map((p) => ({ ...projectCodexHome(p, kind), name: `${p.name} (project)` })),
    ];
    home = await pick(app, choices, (c) => c.name, "Which story or project is this for?");
    if (!home) return;
  }
  const folder = home.folder ?? settings.folders.inbox;

  const fields: Record<string, unknown> = {
    type: kind,
    project: home.link,
    name,
    created: moment().format("YYYY-MM-DD"),
  };
  if (kind === "character") fields.tagline = v.tagline ?? "";
  const tpl = await loadTemplate(app, settings, kind);
  const file = await createNote(app, uniquePath(app, folder, name), render(tpl, { title: name, tagline: v.tagline ?? "" }), fields);
  await app.workspace.getLeaf(false).openFile(file);
}
