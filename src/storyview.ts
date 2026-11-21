import { Component, debounce, ItemView, MarkdownRenderer, moment, setIcon, TFile, WorkspaceLeaf } from "obsidian";
import type InkwellPlugin from "./main";
import { ktrString } from "./integrations/keep-the-rhythm";
import { promoteToLongForm } from "./promote";
import { listRevisions, snapshotDraft } from "./revisions";
import { formatProgress, listStories, newCodexNote, Story, storyForFile, storyFromFolder, storyProgress } from "./stories";

export const STORY_VIEW = "inkwell-story";

export class StoryView extends ItemView {
  private story: Story | null = null;
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
      const s = storyForFile(this.plugin, this.app.workspace.getActiveFile());
      // Keep showing the last story when focus moves to a non-story note or to this panel.
      if (s && s.folder.path !== this.story?.folder.path) {
        this.story = s;
        void this.render();
      }
    };
    this.registerEvent(this.app.workspace.on("file-open", follow));
    this.registerEvent(this.app.workspace.on("active-leaf-change", follow));
    const mine = (f: { path: string }) => !!this.story && f.path.startsWith(this.story.folder.path + "/");
    this.registerEvent(this.app.vault.on("modify", (f) => mine(f) && refresh()));
    this.registerEvent(this.app.vault.on("create", (f) => mine(f) && refresh()));
    this.registerEvent(this.app.vault.on("delete", (f) => mine(f) && refresh()));
    this.registerEvent(this.app.vault.on("rename", () => refresh()));
    this.registerEvent(this.app.metadataCache.on("changed", (f) => mine(f) && refresh()));
    this.story = storyForFile(this.plugin, this.app.workspace.getActiveFile());
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
    if (!this.story) return this.renderList(el);

    const { plugin } = this;
    const story = this.story;
    const p = await storyProgress(plugin, story);
    const fm = story.hub ? this.app.metadataCache.getFileCache(story.hub)?.frontmatter : undefined;

    const head = el.createDiv({ cls: "inkwell-story-head" });
    const back = head.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "All stories" } });
    setIcon(back, "list");
    back.onclick = () => {
      this.story = null;
      void this.render();
    };
    const title = head.createEl("h3", { text: story.name, cls: "inkwell-story-title" });
    if (story.hub) title.onclick = () => this.open(story.hub!);

    if (story.hub) {
      const hub = story.hub;
      const statuses = [...plugin.settings.shortStatuses];
      if (p.status && !statuses.includes(p.status)) statuses.unshift(p.status);
      const sel = head.createEl("select", { cls: "dropdown" });
      statuses.forEach((s) => sel.createEl("option", { text: s, value: s }));
      sel.value = p.status || statuses[0];
      sel.onchange = () => this.app.fileManager.processFrontMatter(hub, (f) => (f.status = sel.value));
    }
    if (fm?.logline) el.createEl("p", { cls: "inkwell-story-logline", text: String(fm.logline) });

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

    // Next step (hub frontmatter `next`)
    if (story.hub) {
      const hub = story.hub;
      const next = el.createDiv({ cls: "inkwell-story-section" });
      next.createDiv({ cls: "inkwell-label", text: "Next step" });
      const input = next.createEl("input", {
        type: "text",
        cls: "inkwell-next",
        attr: { placeholder: "What's the next thing to do?" },
      });
      input.value = fm?.next ? String(fm.next) : "";
      input.onchange = () => this.app.fileManager.processFrontMatter(hub, (f) => (f.next = input.value.trim()));
    }

    // Actions
    const actions = el.createDiv({ cls: "inkwell-story-actions" });
    const btn = (text: string, icon: string, fn: () => unknown, cta = false) => {
      const b = actions.createEl("button", { cls: cta ? "mod-cta" : "" });
      const i = b.createSpan();
      setIcon(i, icon);
      b.appendText(" " + text);
      b.onclick = () => void fn();
    };
    if (draft) btn("Write", "pencil", () => this.open(draft), true);
    if (story.hub) btn("Hub", "file-text", () => this.open(story.hub!));
    if (draft) btn("Snapshot", "history", () => snapshotDraft(plugin, story));
    btn("Promote", "arrow-up-right", () => promoteToLongForm(plugin, story));

    // Cast & places
    const files = story.folder.children.filter((c): c is TFile => c instanceof TFile && c.extension === "md");
    const typeOf = (f: TFile) => this.app.metadataCache.getFileCache(f)?.frontmatter?.type;
    const cast = files.filter((f) => typeOf(f) === "character");
    const places = files.filter((f) => ["location", "place"].includes(typeOf(f)));
    this.fileList(el, "Characters", cast, () => newCodexNote(plugin, "character"));
    this.fileList(el, "Locations", places, () => newCodexNote(plugin, "location"));

    // Notes/
    const notesFolder = this.app.vault.getAbstractFileByPath(`${story.folder.path}/Notes`);
    const notes: TFile[] = [];
    if (notesFolder) {
      this.app.vault.getMarkdownFiles().forEach((f) => f.path.startsWith(notesFolder.path + "/") && notes.push(f));
    }
    if (notes.length) this.fileList(el, "Notes", notes.sort((a, b) => b.stat.mtime - a.stat.mtime));

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
    el.createEl("h3", { text: "Short stories" });
    const stories = listStories(this.plugin);
    if (!stories.length) {
      el.createEl("p", { cls: "inkwell-muted", text: "No short stories yet." });
      return;
    }
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
  }
}
