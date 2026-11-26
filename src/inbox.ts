import { debounce, ItemView, Menu, moment, normalizePath, Notice, setIcon, TFile, TFolder, WorkspaceLeaf } from "obsidian";
import type InkwellPlugin from "./main";
import { CaptureModal } from "./capture";
import { createExercise } from "./exercise";
import { askForm, pick } from "./modals";
import { askProjectDetails, createProject } from "./projects";
import { RESOURCE_KINDS, RESOURCE_LABELS } from "./resources";
import { askStoryDetails, createShortStory } from "./stories";
import { moveFile, slugWords, stripFrontmatter, fmOf, type Frontmatter, fmStr } from "./util";

export const INBOX_VIEW = "inkwell-inbox";


/** Captures still in the Inbox (top level only — Archive/ doesn't count), newest first. */
export function listInbox(plugin: InkwellPlugin): TFile[] {
  const folder = plugin.app.vault.getAbstractFileByPath(normalizePath(plugin.settings.folders.inbox));
  if (!(folder instanceof TFolder)) return [];
  const created = (f: TFile) => {
    const c = fmOf(plugin.app, f)?.created;
    const m = fmStr(c) ? moment(fmStr(c)) : null;
    return m?.isValid() ? m.valueOf() : f.stat.ctime;
  };
  return folder.children
    .filter((c): c is TFile => c instanceof TFile && c.extension === "md")
    .sort((a, b) => created(b) - created(a));
}

export function isInboxFile(plugin: InkwellPlugin, file: TFile | null): file is TFile {
  return !!file && file.parent?.path === normalizePath(plugin.settings.folders.inbox);
}

// ---------- Triage actions ----------

interface Destination {
  name: string;
  folder: string;
  hub: string;
  isProject: boolean;
}

function destinations(plugin: InkwellPlugin): Destination[] {
  const out: Destination[] = [];
  for (const [root, label] of [
    [plugin.settings.folders.writing, "story"],
    [plugin.settings.folders.longProjects, "project"],
  ] as const) {
    const f = plugin.app.vault.getAbstractFileByPath(normalizePath(root));
    if (!(f instanceof TFolder)) continue;
    for (const c of f.children) {
      if (c instanceof TFolder) out.push({ name: `${c.name} (${label})`, folder: c.path, hub: c.name, isProject: label === "project" });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function bodyOf(plugin: InkwellPlugin, file: TFile): Promise<string> {
  return stripFrontmatter(await plugin.app.vault.read(file)).trim();
}

export async function archiveCapture(plugin: InkwellPlugin, file: TFile): Promise<void> {
  await moveFile(plugin.app, file, `${plugin.settings.folders.inbox}/Archive`);
}

async function sendToStory(plugin: InkwellPlugin, file: TFile): Promise<boolean> {
  const d = await pick(plugin.app, destinations(plugin), (x) => x.name, "Send to which story or project?");
  if (!d) return false;
  // Research captures go to a project's Research/ folder; everything else to Notes/.
  const kind = fmOf(plugin.app, file)?.kind;
  const sub = d.isProject && kind === "research" ? "Research" : "Notes";
  await plugin.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => (fm.project = `[[${d.hub}]]`));
  await moveFile(plugin.app, file, `${d.folder}/${sub}`);
  new Notice(`Sent to ${d.hub}/${sub}`);
  return true;
}

async function toExercise(plugin: InkwellPlugin, file: TFile): Promise<boolean> {
  const ex = await createExercise(plugin, null, { text: await bodyOf(plugin, file) });
  if (!ex) return false;
  await archiveCapture(plugin, file);
  return true;
}

async function toPrompt(plugin: InkwellPlugin, file: TFile): Promise<boolean> {
  const text = await bodyOf(plugin, file);
  await plugin.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
    fm.type = "prompt";
    fm.tags = fm.tags ?? [];
    fm.used = 0;
    fm.last_used = "";
    delete fm.kind;
    delete fm.source;
  });
  await moveFile(plugin.app, file, plugin.settings.folders.prompts, slugWords(text, 10, 80) || file.basename);
  new Notice("Saved as a prompt");
  return true;
}

async function toStory(plugin: InkwellPlugin, file: TFile): Promise<boolean> {
  const text = await bodyOf(plugin, file);
  const firstLine = text.split("\n")[0] ?? "";
  const input = await askStoryDetails(plugin, {
    title: slugWords(text, 6, 50),
    logline: firstLine.length <= 200 ? firstLine : "",
  });
  if (!input) return false;
  const story = await createShortStory(plugin, input);
  if (!story) return false;
  // The capture becomes the story's first note.
  await plugin.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => (fm.project = `[[${input.title}]]`));
  await moveFile(plugin.app, file, `${story.folder.path}/Notes`);
  return true;
}

async function toProject(plugin: InkwellPlugin, file: TFile): Promise<boolean> {
  const text = await bodyOf(plugin, file);
  const firstLine = text.split("\n")[0] ?? "";
  const input = await askProjectDetails(plugin, {
    title: slugWords(text, 6, 50),
    logline: firstLine.length <= 200 ? firstLine : "",
  });
  if (!input) return false;
  const project = await createProject(plugin, input);
  if (!project) return false;
  // The capture becomes the project's first note (or research note).
  const kind = fmOf(plugin.app, file)?.kind;
  await plugin.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => (fm.project = `[[${input.title}]]`));
  await moveFile(plugin.app, file, `${project.folder.path}/${kind === "research" ? "Research" : "Notes"}`);
  return true;
}

async function toResource(plugin: InkwellPlugin, file: TFile): Promise<boolean> {
  const kind = await pick(plugin.app, [...RESOURCE_KINDS], (k) => RESOURCE_LABELS[k], "What kind of resource?");
  if (!kind) return false;
  const text = await bodyOf(plugin, file);
  const url = text.match(/https?:\/\/\S+/)?.[0]?.replace(/[)>\].,]+$/, "") ?? "";
  const v = await askForm(plugin.app, "File as resource", [
    { key: "title", label: "Title", required: true, value: slugWords(text.replace(/https?:\/\/\S+/g, ""), 8, 60) },
    { key: "author", label: "Author", placeholder: "optional" },
    { key: "url", label: "URL", value: url },
  ], "File");
  if (!v) return false;
  await plugin.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
    fm.type = "resource";
    fm.kind = kind;
    fm.status = "to-do";
    fm.author = v.author;
    fm.url = v.url;
    delete fm.source;
  });
  await moveFile(plugin.app, file, plugin.settings.folders.resources, v.title);
  new Notice("Filed as resource");
  return true;
}

export function triageMenu(plugin: InkwellPlugin, file: TFile, menu: Menu): void {
  const kind = fmOf(plugin.app, file)?.kind;
  const item = (title: string, icon: string, fn: () => Promise<unknown>) =>
    menu.addItem((i) =>
      i.setTitle(title).setIcon(icon).onClick(() => {
        fn().catch((e) => {
          console.error("Inkwell triage failed", e);
          new Notice(`Failed: ${(e as Error).message}`);
        });
      })
    );
  item("Send to story / project…", "folder-input", () => sendToStory(plugin, file));
  item("New short story from this…", "book-plus", () => toStory(plugin, file));
  item("New project from this…", "library-big", () => toProject(plugin, file));
  item("Turn into exercise…", "pencil-line", () => toExercise(plugin, file));
  item(kind === "prompt" ? "Save as prompt note ★" : "Save as prompt note", "sparkles", () => toPrompt(plugin, file));
  item("File as resource…", "library", () => toResource(plugin, file));
  menu.addSeparator();
  item("Archive", "archive", () => archiveCapture(plugin, file));
  item("Delete", "trash-2", () => plugin.app.fileManager.trashFile(file));
}

// ---------- Panel ----------

export class InboxView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: InkwellPlugin) {
    super(leaf);
  }
  getViewType() {
    return INBOX_VIEW;
  }
  getDisplayText() {
    return "Inbox";
  }
  getIcon() {
    return "inbox";
  }

  async onOpen() {
    const refresh = debounce(() => void this.render(), 300, true);
    const inInbox = (path: string) => path.startsWith(normalizePath(this.plugin.settings.folders.inbox) + "/");
    this.registerEvent(this.app.vault.on("create", (f) => inInbox(f.path) && refresh()));
    this.registerEvent(this.app.vault.on("delete", (f) => inInbox(f.path) && refresh()));
    this.registerEvent(this.app.vault.on("modify", (f) => inInbox(f.path) && refresh()));
    this.registerEvent(this.app.vault.on("rename", (f, old) => (inInbox(f.path) || inInbox(old)) && refresh()));
    this.registerEvent(this.app.metadataCache.on("changed", (f) => inInbox(f.path) && refresh()));
    await this.render();
  }

  async render() {
    const el = this.contentEl;
    el.empty();
    el.addClass("inkwell-inbox");
    const files = listInbox(this.plugin);

    const header = el.createDiv({ cls: "inkwell-inbox-header" });
    header.createSpan({ cls: "inkwell-inbox-title", text: "Inbox" });
    header.createSpan({ cls: "inkwell-inbox-count", text: String(files.length) });
    const add = header.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Quick capture" } });
    setIcon(add, "plus");
    add.onclick = () => new CaptureModal(this.app, this.plugin).open();

    if (!files.length) {
      el.createDiv({ cls: "inkwell-inbox-empty", text: "Inbox zero ✨" });
      return;
    }

    const list = el.createDiv({ cls: "inkwell-inbox-list" });
    for (const file of files) {
      const fm = fmOf(this.app, file);
      const row = list.createDiv({ cls: "inkwell-inbox-item" });
      const meta = row.createDiv({ cls: "inkwell-inbox-meta" });
      meta.createSpan({ cls: "inkwell-kind", text: fmStr(fm?.kind) || fmStr(fm?.type) || "note" });
      const created = fmStr(fm?.created) ? moment(fmStr(fm?.created)) : moment(file.stat.ctime);
      meta.createSpan({ cls: "inkwell-inbox-age", text: created.isValid() ? created.fromNow() : "" });

      const actions = meta.createDiv({ cls: "inkwell-inbox-actions" });
      const archive = actions.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Archive" } });
      setIcon(archive, "archive");
      archive.onclick = (e) => {
        e.stopPropagation();
        void archiveCapture(this.plugin, file);
      };
      const more = actions.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Triage" } });
      setIcon(more, "more-horizontal");
      more.onclick = (e) => {
        e.stopPropagation();
        const menu = new Menu();
        triageMenu(this.plugin, file, menu);
        menu.showAtMouseEvent(e);
      };

      const preview = row.createDiv({ cls: "inkwell-inbox-preview" });
      const body = stripFrontmatter(await this.app.vault.cachedRead(file)).trim();
      preview.setText(body.length > 160 ? body.slice(0, 160) + "…" : body || file.basename);
      row.onclick = () => this.app.workspace.getLeaf(false).openFile(file);
    }
  }
}
