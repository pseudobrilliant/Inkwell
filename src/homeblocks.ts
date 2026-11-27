import { debounce, MarkdownRenderChild, moment, normalizePath, TFile } from "obsidian";
import type InkwellPlugin from "./main";
import { listInbox } from "./inbox";
import { listLongProjects, projectWords } from "./projects";
import { listStories, storyProgress } from "./stories";
import { stripFrontmatter, fmOf, fmStr } from "./util";

/** Block options: simple "key: value" lines. */
export function opts(src: string): Record<string, string> {
  const o: Record<string, string> = {};
  for (const line of src.split("\n")) {
    const m = line.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
    if (m?.[1]) o[m[1].toLowerCase()] = m[2] ?? "";
  }
  return o;
}

/** True if a path is inside one of Inkwell's folders: the only notes a live block can show. */
export function inInkwellFolders(folders: Record<string, string>, path: string): boolean {
  return Object.values(folders).some((f) => {
    const dir = normalizePath(f);
    return path === dir || path.startsWith(dir + "/");
  });
}

/**
 * A self-refreshing block. It redraws when a note in one of Inkwell's folders is created, deleted, renamed or
 * changes, not on every edit in the vault. The new content is drawn off-screen and swapped in, so it doesn't
 * flicker, and a slow draw that is overtaken by a newer one is dropped.
 */
export class LiveBlock extends MarkdownRenderChild {
  private generation = 0;

  constructor(el: HTMLElement, private plugin: InkwellPlugin, private draw: (el: HTMLElement, child: LiveBlock) => Promise<void>) {
    super(el);
  }
  onload() {
    const redraw = debounce(() => void this.redraw(), 800, true);
    const mine = (path: string) => inInkwellFolders(this.plugin.settings.folders, path);
    const { vault, metadataCache } = this.plugin.app;
    this.registerEvent(vault.on("create", (f) => mine(f.path) && redraw()));
    this.registerEvent(vault.on("delete", (f) => mine(f.path) && redraw()));
    this.registerEvent(vault.on("rename", (f, old) => (mine(f.path) || mine(old)) && redraw()));
    this.registerEvent(metadataCache.on("changed", (f) => mine(f.path) && redraw()));
    void this.redraw();
  }
  async redraw() {
    const gen = ++this.generation;
    const next = this.containerEl.doc.createElement("div");
    await this.draw(next, this);
    if (gen !== this.generation) return;
    this.containerEl.addClasses(Array.from(next.classList));
    this.containerEl.replaceChildren(...Array.from(next.childNodes));
  }
}

const openFile = (plugin: InkwellPlugin, f: TFile) => plugin.app.workspace.getLeaf(false).openFile(f);

export function registerHomeBlocks(plugin: InkwellPlugin): void {
  // ```inkwell-inbox```  (options: limit: 5, title: <text>|none)
  plugin.registerMarkdownCodeBlockProcessor("inkwell-inbox", (src, el, ctx) => {
    const o = opts(src);
    const limit = parseInt(o.limit ?? "", 10) || 5;
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
          const kind = fmStr(fmOf(plugin.app, f)?.kind);
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
              week: draft ? await plugin.words.wordsThisWeek((path) => path === draft.path) : null,
              last: p.lastWorked ?? 0,
            });
          }
        }
        if (include !== "short") {
          for (const lp of listLongProjects(plugin)) {
            const fm = lp.hub ? fmOf(plugin.app, lp.hub) : undefined;
            const status = fmStr(fm?.status);
            if (!showDone && notActive.has(status)) continue;
            const scenesPrefix = `${lp.folder.path}/Scenes/`;
            rows.push({
              name: lp.name,
              hub: lp.hub,
              status,
              words: await projectWords(plugin, lp),
              target: Number(fm?.target_wordcount) || 0,
              week: await plugin.words.wordsThisWeek((path) => path.startsWith(scenesPrefix)),
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
        ["Title", "Status", "Words", "This week", "Last worked"].forEach((h) => hr.createEl("th", { text: h }));
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
}
