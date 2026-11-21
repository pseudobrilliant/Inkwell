import { Component, debounce, ItemView, MarkdownRenderer, moment, setIcon, TFile, TFolder, WorkspaceLeaf } from "obsidian";
import type InkwellPlugin from "./main";
import { ktrString } from "./integrations/keep-the-rhythm";
import { promoteToLongForm } from "./promote";
import { listLongProjects, LongProject, newScene, projectForFile, projectFromFolder, projectProgress } from "./projects";
import { countWords } from "./wordcount";
import { listRevisions, snapshotDraft } from "./revisions";
import { formatProgress, listStories, newCodexNote, Story, storyForFile, storyFromFolder, storyProgress } from "./stories";

export const STORY_VIEW = "inkwell-story";

export class StoryView extends ItemView {
  private story: Story | null = null;
  private project: LongProject | null = null;
  private md: Component | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: InkwellPlugin) {
    super(leaf);
  }
  getViewType() {
    return STORY_VIEW;
  }
  getDisplayText() {
    return "Story";
  }
  getIcon() {
    return "book-open";
  }

  async onOpen() {
    const refresh = debounce(() => void this.render(), 500, true);
    const follow = () => {
      const file = this.app.workspace.getActiveFile();
      const s = storyForFile(this.plugin, file);
      const p = s ? null : projectForFile(this.plugin, file);
      // Keep showing the last story/project when focus moves to an unrelated note or to this panel.
      if (s && s.folder.path !== this.story?.folder.path) {
        this.story = s;
        this.project = null;
        void this.render();
      } else if (p && p.folder.path !== this.project?.folder.path) {
        this.project = p;
        this.story = null;
        void this.render();
      }
    };
    this.registerEvent(this.app.workspace.on("file-open", follow));
    this.registerEvent(this.app.workspace.on("active-leaf-change", follow));
    const mine = (f: { path: string }) => {
      const root = this.story?.folder.path ?? this.project?.folder.path;
      return !!root && f.path.startsWith(root + "/");
    };
    this.registerEvent(this.app.vault.on("modify", (f) => mine(f) && refresh()));
    this.registerEvent(this.app.vault.on("create", (f) => mine(f) && refresh()));
    this.registerEvent(this.app.vault.on("delete", (f) => mine(f) && refresh()));
    this.registerEvent(this.app.vault.on("rename", () => refresh()));
    this.registerEvent(this.app.metadataCache.on("changed", (f) => mine(f) && refresh()));
    const file = this.app.workspace.getActiveFile();
    this.story = storyForFile(this.plugin, file);
    this.project = this.story ? null : projectForFile(this.plugin, file);
    await this.render();
  }

  async onClose() {
    this.md?.unload();
  }

  private open(file: TFile) {
    void this.app.workspace.getLeaf(false).openFile(file);
  }

  async render() {
    const el = this.contentEl;
    el.empty();
    el.addClass("inkwell-story-view");
    this.md?.unload();
    this.md = this.addChild(new Component());

    // Re-resolve: the folder may have been renamed, promoted or deleted.
    if (this.story) {
      const f = this.app.vault.getAbstractFileByPath(this.story.folder.path);
      this.story = f ? storyFromFolder(this.plugin, this.story.folder) : null;
    }
    if (this.project) {
      const f = this.app.vault.getAbstractFileByPath(this.project.folder.path);
      this.project = f instanceof TFolder ? projectFromFolder(this.plugin, f) : null;
      if (this.project) return this.renderProject(el, this.project);
    }
    if (!this.story) return this.renderList(el);

    const { plugin } = this;
    const story = this.story;
    const p = await storyProgress(plugin, story);
    const fm = story.hub ? this.app.metadataCache.getFileCache(story.hub)?.frontmatter : undefined;

    const head = el.createDiv({ cls: "inkwell-story-head" });
    this.renderHead(el, story.name, story.hub, p.status, fm?.logline);

    // Progress
    const prog = el.createDiv({ cls: "inkwell-story-section" });
    if (p.target) {
      const bar = prog.createEl("progress", { cls: "inkwell-progress" });
      bar.max = p.target;
      bar.value = Math.min(p.words, p.target);
    }
    const stats = prog.createDiv({ cls: "inkwell-story-stats" });
    stats.createDiv({ text: formatProgress(p) + (p.target ? ` · ${Math.round((p.words / p.target) * 100)}%` : "") });
    const draft = story.draft;
    if (draft) {
      const week = await plugin.ktr.wordsThisWeek((path) => path === draft.path);
      if (week !== null) stats.createDiv({ text: `${week.toLocaleString()} words this week` });
    }
    stats.createDiv({
      cls: "inkwell-muted",
      text: p.lastWorked ? `Last worked ${moment(p.lastWorked).fromNow()}` : "No draft yet",
    });

    if (story.hub) this.renderNext(el, story.hub, fm?.next);

    // Actions
    const btn = this.actions(el);
    if (draft) btn("Write", "pencil", () => this.open(draft), true);
    if (story.hub) btn("Hub", "file-text", () => this.open(story.hub!));
    if (draft) btn("Snapshot", "history", () => snapshotDraft(plugin, story));
    btn("Promote", "arrow-up-right", () => promoteToLongForm(plugin, story));

    // Cast & places
    const files = story.folder.children.filter((c): c is TFile => c instanceof TFile && c.extension === "md");
    const typeOf = (f: TFile) => this.app.metadataCache.getFileCache(f)?.frontmatter?.type;
    const cast = files.filter((f) => typeOf(f) === "character");
    const places = files.filter((f) => ["location", "place"].includes(typeOf(f)));
    this.fileList(el, "Characters", cast, () => newCodexNote(plugin, "character", story.hub ?? story.draft));
    this.fileList(el, "Locations", places, () => newCodexNote(plugin, "location", story.hub ?? story.draft));

    // Notes/
    const notes = this.filesUnder(`${story.folder.path}/Notes`);
    if (notes.length) this.fileList(el, "Notes", notes);

    // Revisions
    const revs = await listRevisions(plugin, story);
    if (revs.length) {
      const sec = el.createDiv({ cls: "inkwell-story-section" });
      sec.createDiv({ cls: "inkwell-label", text: "Revisions" });
      const list = sec.createEl("ul", { cls: "inkwell-revisions" });
      let prev: number | null = null;
      const row = (label: string, words: number, file: TFile | null) => {
        const li = list.createEl("li");
        const a = li.createEl("a", { text: label });
        if (file) a.onclick = () => this.open(file);
        const delta = prev === null ? "" : ` (${words - prev >= 0 ? "+" : ""}${(words - prev).toLocaleString()})`;
        li.appendText(` — ${words.toLocaleString()} words${delta}`);
        prev = words;
      };
      for (const r of revs) row(`v${r.version} · ${r.date}`, r.words, r.file);
      const cur = Number(fm && draft ? this.app.metadataCache.getFileCache(draft)?.frontmatter?.version : 0) || revs.length + 1;
      row(`v${cur} · current`, p.words, draft);
    }

    // Keep the Rhythm heatmap for this draft
    if (draft && plugin.ktr.status().ok) {
      const sec = el.createDiv({ cls: "inkwell-story-section" });
      sec.createDiv({ cls: "inkwell-label", text: "Writing days" });
      await MarkdownRenderer.render(
        this.app,
        plugin.ktr.heatmapBlock(`filePath == ${ktrString(draft.path)}`, 12),
        sec.createDiv(),
        draft.path,
        this.md
      );
    }
  }

  private renderHead(el: HTMLElement, name: string, hub: TFile | null, status: string, logline: unknown) {
    const head = el.createDiv({ cls: "inkwell-story-head" });
    const back = head.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "All stories and projects" } });
    setIcon(back, "list");
    back.onclick = () => {
      this.story = null;
      this.project = null;
      void this.render();
    };
    const title = head.createEl("h3", { text: name, cls: "inkwell-story-title" });
    if (hub) {
      title.onclick = () => this.open(hub);
      const statuses = [...this.plugin.settings.shortStatuses];
      if (status && !statuses.includes(status)) statuses.unshift(status);
      const sel = head.createEl("select", { cls: "dropdown" });
      statuses.forEach((s) => sel.createEl("option", { text: s, value: s }));
      sel.value = status || statuses[0];
      sel.onchange = () => this.app.fileManager.processFrontMatter(hub, (f) => (f.status = sel.value));
    }
    if (logline) el.createEl("p", { cls: "inkwell-story-logline", text: String(logline) });
  }

  /** Next step (hub frontmatter `next`). */
  private renderNext(el: HTMLElement, hub: TFile, value: unknown) {
    const next = el.createDiv({ cls: "inkwell-story-section" });
    next.createDiv({ cls: "inkwell-label", text: "Next step" });
    const input = next.createEl("input", {
      type: "text",
      cls: "inkwell-next",
      attr: { placeholder: "What's the next thing to do?" },
    });
    input.value = value ? String(value) : "";
    input.onchange = () => this.app.fileManager.processFrontMatter(hub, (f) => (f.next = input.value.trim()));
  }

  private actions(el: HTMLElement) {
    const actions = el.createDiv({ cls: "inkwell-story-actions" });
    return (text: string, icon: string, fn: () => unknown, cta = false) => {
      const b = actions.createEl("button", { cls: cta ? "mod-cta" : "" });
      const i = b.createSpan();
      setIcon(i, icon);
      b.appendText(" " + text);
      b.onclick = () => void fn();
    };
  }

  /** Markdown files anywhere under a folder, most recently changed first. */
  private filesUnder(path: string): TFile[] {
    return this.app.vault
      .getMarkdownFiles()
      .filter((f) => f.path.startsWith(path + "/"))
      .sort((a, b) => b.stat.mtime - a.stat.mtime);
  }

  private async renderProject(el: HTMLElement, project: LongProject) {
    const { plugin } = this;
    const p = await projectProgress(plugin, project);
    const fm = project.hub ? this.app.metadataCache.getFileCache(project.hub)?.frontmatter : undefined;
    this.renderHead(el, project.name, project.hub, p.status, fm?.logline);

    // Progress
    const prog = el.createDiv({ cls: "inkwell-story-section" });
    if (p.target) {
      const bar = prog.createEl("progress", { cls: "inkwell-progress" });
      bar.max = p.target;
      bar.value = Math.min(p.words, p.target);
    }
    const stats = prog.createDiv({ cls: "inkwell-story-stats" });
    stats.createDiv({ text: formatProgress(p) + (p.target ? ` · ${Math.round((p.words / p.target) * 100)}%` : "") });
    const scenesPrefix = `${project.folder.path}/Scenes/`;
    const week = await plugin.ktr.wordsThisWeek((path) => path.startsWith(scenesPrefix));
    if (week !== null) stats.createDiv({ text: `${week.toLocaleString()} words this week` });
    stats.createDiv({
      cls: "inkwell-muted",
      text: p.lastWorked ? `Last worked ${moment(p.lastWorked).fromNow()}` : "No scenes yet",
    });

    if (project.hub) this.renderNext(el, project.hub, fm?.next);

    const btn = this.actions(el);
    if (project.hub) btn("Project note", "file-text", () => this.open(project.hub!));
    btn("New scene", "plus", () => newScene(plugin, project), !project.scenes.length);

    // Scenes in order, with status and word count
    const sec = el.createDiv({ cls: "inkwell-story-section" });
    const h = sec.createDiv({ cls: "inkwell-label" });
    h.setText(`Scenes (${project.scenes.length})`);
    const add = h.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "New scene" } });
    setIcon(add, "plus");
    add.onclick = () => void newScene(plugin, project);
    if (project.scenes.length) {
      const ol = sec.createEl("ol", { cls: "inkwell-scene-list" });
      for (const s of project.scenes) {
        const sfm = this.app.metadataCache.getFileCache(s)?.frontmatter;
        const li = ol.createEl("li");
        li.createEl("a", { text: String(sfm?.title ?? s.basename) }).onclick = () => this.open(s);
        const words = countWords(await this.app.vault.cachedRead(s));
        li.createSpan({ cls: "inkwell-muted", text: ` — ${sfm?.status ?? "?"} · ${words.toLocaleString()} words` });
      }
    }

    // Codex, notes, research
    const anchor = project.hub ?? project.scenes[0] ?? null;
    this.fileList(el, "Characters", this.filesUnder(`${project.folder.path}/Codex/Characters`), () =>
      newCodexNote(plugin, "character", anchor)
    );
    this.fileList(el, "Locations", this.filesUnder(`${project.folder.path}/Codex/Locations`), () =>
      newCodexNote(plugin, "location", anchor)
    );
    const notes = this.filesUnder(`${project.folder.path}/Notes`);
    if (notes.length) this.fileList(el, "Notes", notes);
    const research = this.filesUnder(`${project.folder.path}/Research`);
    if (research.length) this.fileList(el, "Research", research);

    // Keep the Rhythm heatmap for this project's scenes
    if (plugin.ktr.status().ok) {
      const hs = el.createDiv({ cls: "inkwell-story-section" });
      hs.createDiv({ cls: "inkwell-label", text: "Writing days" });
      await MarkdownRenderer.render(
        this.app,
        plugin.ktr.heatmapBlock(`filePath starts_with ${ktrString(scenesPrefix)}`, 12),
        hs.createDiv(),
        project.hub?.path ?? "",
        this.md!
      );
    }
  }

  private fileList(el: HTMLElement, label: string, files: TFile[], onAdd?: () => unknown) {
    const sec = el.createDiv({ cls: "inkwell-story-section" });
    const h = sec.createDiv({ cls: "inkwell-label" });
    h.setText(`${label} (${files.length})`);
    if (onAdd) {
      const add = h.createEl("button", { cls: "clickable-icon", attr: { "aria-label": `New ${label.toLowerCase()}` } });
      setIcon(add, "plus");
      add.onclick = () => void onAdd();
    }
    if (!files.length) return;
    const ul = sec.createEl("ul");
    for (const f of files) {
      const a = ul.createEl("li").createEl("a", { text: f.basename });
      a.onclick = () => this.open(f);
    }
  }

  private async renderList(el: HTMLElement) {
    el.createEl("h3", { text: "Stories" });
    const stories = listStories(this.plugin);
    if (!stories.length) el.createEl("p", { cls: "inkwell-muted", text: "No stories yet." });
    const ul = el.createEl("ul", { cls: "inkwell-story-list" });
    for (const s of stories) {
      const p = await storyProgress(this.plugin, s);
      const li = ul.createEl("li");
      const a = li.createEl("a", { text: s.name });
      a.onclick = () => {
        this.story = s;
        void this.render();
      };
      li.createSpan({ cls: "inkwell-muted", text: ` — ${p.status || "?"} · ${formatProgress(p)}` });
    }

    el.createEl("h3", { text: "Projects" });
    const projects = listLongProjects(this.plugin);
    if (!projects.length) el.createEl("p", { cls: "inkwell-muted", text: "No projects yet." });
    const pl = el.createEl("ul", { cls: "inkwell-story-list" });
    for (const pr of projects) {
      const p = await projectProgress(this.plugin, pr);
      const li = pl.createEl("li");
      li.createEl("a", { text: pr.name }).onclick = () => {
        this.project = pr;
        this.story = null;
        void this.render();
      };
      li.createSpan({ cls: "inkwell-muted", text: ` — ${p.status || "?"} · ${formatProgress(p)}` });
    }
  }
}
