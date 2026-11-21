import { App, Modal, moment, Notice, normalizePath, Setting, TFile, TFolder } from "obsidian";
import type InkwellPlugin from "./main";
import { askForm, pick } from "./modals";
import { loadTemplate, render } from "./templates";
import { cleanName, createNote, ensureFolder, uniquePath } from "./util";
import { countWords } from "./wordcount";

export interface Story {
  name: string;
  folder: TFolder;
  hub: TFile | null;
  draft: TFile | null;
}

function typeOf(app: App, f: TFile): string | undefined {
  return app.metadataCache.getFileCache(f)?.frontmatter?.type;
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
  const version = (f: TFile) => Number(app.metadataCache.getFileCache(f)?.frontmatter?.version) || 1;
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

export async function newShortStory(plugin: InkwellPlugin): Promise<void> {
  const { app, settings } = plugin;
  const v = await askForm(app, "New short story", [
    { key: "title", label: "Title", required: true },
    { key: "logline", label: "Logline", placeholder: "optional" },
    { key: "genre", label: "Genre", placeholder: "optional" },
    { key: "target", label: "Target words", type: "number", value: String(settings.defaultShortTarget || "") },
  ]);
  if (!v) return;
  const title = cleanName(v.title);
  if (!title) return;
  const folder = normalizePath(`${settings.folders.writing}/${title}`);
  if (app.vault.getAbstractFileByPath(folder)) {
    new Notice(`A story folder named "${title}" already exists.`);
    return;
  }
  await ensureFolder(app, folder);
  const vars = { title, logline: v.logline, genre: v.genre, date: moment().format("YYYY-MM-DD") };

  const hubFields: Record<string, unknown> = {
    type: "story",
    status: settings.shortStatuses[0] ?? "idea",
    logline: v.logline,
    genre: v.genre,
    created: vars.date,
  };
  const target = parseInt(v.target, 10);
  if (target > 0) hubFields.target_wordcount = target;

  const hub = await createNote(app, `${folder}/${title}.md`, render(await loadTemplate(app, settings, "storyHub"), vars), hubFields);
  await createNote(app, `${folder}/${title} - Draft.md`, render(await loadTemplate(app, settings, "storyDraft"), vars), {
    type: "draft",
    project: `[[${title}]]`,
    version: 1,
  });
  await app.workspace.getLeaf(false).openFile(hub);
}

export interface Progress {
  status: string;
  words: number;
  target: number;
  lastWorked: number | null;
}

export async function storyProgress(plugin: InkwellPlugin, story: Story): Promise<Progress> {
  const fm = story.hub ? plugin.app.metadataCache.getFileCache(story.hub)?.frontmatter : undefined;
  const words = story.draft ? countWords(await plugin.app.vault.cachedRead(story.draft)) : 0;
  return {
    status: fm?.status ?? "",
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
        d.setValue(p.status || statuses[0]);
        d.onChange(async (s) => {
          await plugin.app.fileManager.processFrontMatter(hub, (fm) => (fm.status = s));
          plugin.refreshStatusBar();
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

/** New character or location: in the current story folder, or a chosen one. */
export async function newCodexNote(plugin: InkwellPlugin, kind: "character" | "location"): Promise<void> {
  const { app, settings } = plugin;
  const v = await askForm(app, kind === "character" ? "New character" : "New location", [
    { key: "name", label: "Name", required: true },
    ...(kind === "character" ? [{ key: "tagline", label: "Tagline", placeholder: "one line, optional" }] : []),
  ]);
  if (!v) return;
  const name = cleanName(v.name);
  if (!name) return;

  let story = storyForFile(plugin, app.workspace.getActiveFile());
  let folder: string;
  if (story) {
    folder = story.folder.path;
  } else {
    const inbox = { name: "(No story — Inbox)", folder: null } as unknown as Story;
    const choice = await pick(app, [inbox, ...listStories(plugin)], (s) => s.name, "Which story is this for?");
    if (!choice) return;
    story = choice.folder ? choice : null;
    folder = story ? story.folder.path : settings.folders.inbox;
  }

  const fields: Record<string, unknown> = {
    type: kind,
    project: story ? `[[${story.hub?.basename ?? story.name}]]` : "",
    name,
    created: moment().format("YYYY-MM-DD"),
  };
  if (kind === "character") fields.tagline = v.tagline ?? "";
  const tpl = await loadTemplate(app, settings, kind);
  const file = await createNote(app, uniquePath(app, folder, name), render(tpl, { title: name, tagline: v.tagline ?? "" }), fields);
  await app.workspace.getLeaf(false).openFile(file);
}
