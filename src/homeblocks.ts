import { debounce, MarkdownRenderChild, MarkdownRenderer, moment, TFile } from "obsidian";
import type InkwellPlugin from "./main";
import { listInbox } from "./inbox";
import { listLongProjects, projectWords } from "./projects";
import { listStories, storyProgress } from "./stories";
import { stripFrontmatter } from "./util";

/** Block options: simple "key: value" lines. */
function opts(src: string): Record<string, string> {
  const o: Record<string, string> = {};
  for (const line of src.split("\n")) {
    const m = line.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
    if (m) o[m[1].toLowerCase()] = m[2];
  }
  return o;
}

/** A self-refreshing block that redraws when the vault or metadata changes. */
class LiveBlock extends MarkdownRenderChild {
  constructor(el: HTMLElement, private plugin: InkwellPlugin, private draw: (el: HTMLElement, child: LiveBlock) => Promise<void>) {
    super(el);
  }
  onload() {
    const redraw = debounce(() => void this.redraw(), 800, true);
    this.registerEvent(this.plugin.app.vault.on("create", redraw));
    this.registerEvent(this.plugin.app.vault.on("delete", redraw));
    this.registerEvent(this.plugin.app.vault.on("rename", redraw));
    this.registerEvent(this.plugin.app.metadataCache.on("changed", redraw));
    void this.redraw();
  }
  async redraw() {
    this.containerEl.empty();
    await this.draw(this.containerEl, this);
  }
}

const openFile = (plugin: InkwellPlugin, f: TFile) => plugin.app.workspace.getLeaf(false).openFile(f);

export function registerHomeBlocks(plugin: InkwellPlugin): void {
  // ```inkwell-inbox```  (options: limit: 5, title: <text>|none)
  plugin.registerMarkdownCodeBlockProcessor("inkwell-inbox", (src, el, ctx) => {
    const o = opts(src);
    const limit = parseInt(o.limit, 10) || 5;
    ctx.addChild(
      new LiveBlock(el, plugin, async (box) => {
        box.addClass("inkwell-block");
        const files = listInbox(plugin);
        const head = box.createDiv({ cls: "inkwell-block-head" });
        if (o.title !== "none") head.createSpan({ text: o.title || "Inbox" });
        head.createSpan({ cls: "inkwell-inbox-count", text: String(files.length) });
        const open = head.createEl("button", { text: "Open inbox" });
        open.onclick = () => void plugin.activateInbox();
        if (!files.length) {
          box.createDiv({ cls: "inkwell-muted", text: "Inbox zero ✨" });
          return;
        }
        const ul = box.createEl("ul");
        for (const f of files.slice(0, limit)) {
          const kind = plugin.app.metadataCache.getFileCache(f)?.frontmatter?.kind ?? "";
          const body = stripFrontmatter(await plugin.app.vault.cachedRead(f)).trim().split("\n")[0] ?? "";
          const li = ul.createEl("li");
          if (kind) li.createSpan({ cls: "inkwell-kind", text: kind + " " });
          li.createEl("a", { text: body.length > 80 ? body.slice(0, 80) + "…" : body || f.basename }).onclick = () =>
            openFile(plugin, f);
        }
        if (files.length > limit) box.createDiv({ cls: "inkwell-muted", text: `+ ${files.length - limit} more` });
      })
    );
  });

  // ```inkwell-in-progress```  (options: include: short|long|all, show-done: true, title: <text>|none)
  plugin.registerMarkdownCodeBlockProcessor("inkwell-in-progress", (src, el, ctx) => {
    const o = opts(src);
    const include = (o.include ?? "all").toLowerCase();
    const showDone = o["show-done"] === "true";
    ctx.addChild(
      new LiveBlock(el, plugin, async (box) => {
        box.addClass("inkwell-block");
        if (o.title !== "none") box.createDiv({ cls: "inkwell-block-head", text: o.title || "In progress" });
        const s = plugin.settings;
        const notActive = new Set([s.shortStatuses[0], s.shortStatuses[s.shortStatuses.length - 1], "idea", "done", "final", "abandoned"]);
        const rows: { name: string; hub: TFile | null; status: string; words: number; target: number; week: number | null; last: number }[] = [];

        if (include !== "long") {
          for (const st of listStories(plugin)) {
            const p = await storyProgress(plugin, st);
            if (!showDone && notActive.has(p.status)) continue;
            const draft = st.draft;
            rows.push({
              name: st.name,
              hub: st.hub,
              status: p.status,
              words: p.words,
              target: p.target,
              week: draft ? await plugin.ktr.wordsThisWeek((path) => path === draft.path) : null,
              last: p.lastWorked ?? 0,
            });
          }
        }
        if (include !== "short") {
          for (const lp of listLongProjects(plugin)) {
            const fm = lp.hub ? plugin.app.metadataCache.getFileCache(lp.hub)?.frontmatter : undefined;
            const status = String(fm?.status ?? "");
            if (!showDone && notActive.has(status)) continue;
            const scenesPrefix = `${lp.folder.path}/Scenes/`;
            rows.push({
              name: lp.name,
              hub: lp.hub,
              status,
              words: await projectWords(plugin, lp),
              target: Number(fm?.target_wordcount) || 0,
              week: await plugin.ktr.wordsThisWeek((path) => path.startsWith(scenesPrefix)),
              last: Math.max(0, ...lp.scenes.map((f) => f.stat.mtime)),
            });
          }
        }
        if (!rows.length) {
          box.createDiv({ cls: "inkwell-muted", text: "Nothing in progress." });
          return;
        }
        rows.sort((a, b) => b.last - a.last);
        const table = box.createEl("table", { cls: "inkwell-progress-table" });
        const hr = table.createEl("thead").createEl("tr");
        ["Story", "Status", "Words", "This week", "Last worked"].forEach((h) => hr.createEl("th", { text: h }));
        const tb = table.createEl("tbody");
        for (const r of rows) {
          const tr = tb.createEl("tr");
          const a = tr.createEl("td").createEl("a", { text: r.name });
          if (r.hub) a.onclick = () => openFile(plugin, r.hub!);
          tr.createEl("td", { text: r.status });
          const w = tr.createEl("td");
          w.createDiv({ text: r.target ? `${r.words.toLocaleString()} / ${r.target.toLocaleString()}` : r.words.toLocaleString() });
          if (r.target) {
            const bar = w.createEl("progress", { cls: "inkwell-progress" });
            bar.max = r.target;
            bar.value = Math.min(r.words, r.target);
          }
          tr.createEl("td", { text: r.week === null ? "—" : r.week.toLocaleString() });
          tr.createEl("td", { text: r.last ? moment(r.last).fromNow() : "—" });
        }
      })
    );
  });

  // ```inkwell-heatmap```  Keep the Rhythm heatmap of story drafts + scenes only (option: weeks: 24)
  plugin.registerMarkdownCodeBlockProcessor("inkwell-heatmap", async (src, el, ctx) => {
    const st = plugin.ktr.status();
    if (!st.ok) {
      el.createDiv({ cls: "inkwell-muted", text: st.message });
      return;
    }
    const weeks = parseInt(opts(src).weeks, 10) || 24;
    const w = JSON.stringify(plugin.settings.folders.writing + "/");
    const l = JSON.stringify(plugin.settings.folders.longProjects + "/");
    const filter = `(filePath starts_with ${w} && filePath contains " - Draft.md") || (filePath starts_with ${l} && filePath contains "/Scenes/")`;
    const child = new MarkdownRenderChild(el);
    ctx.addChild(child);
    await MarkdownRenderer.render(plugin.app, plugin.ktr.heatmapBlock(filter, weeks), el, ctx.sourcePath, child);
  });
}
