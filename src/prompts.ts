import { App, MarkdownRenderChild, Modal, moment, normalizePath, Notice, Setting, TFile, TFolder } from "obsidian";
import type InkwellPlugin from "./main";
import { askForm } from "./modals";
import { cleanName, createNote, ensureFolder, slugWords, uniquePath, fmDay, fmOf, type Frontmatter } from "./util";

export interface Prompt {
  file: TFile;
  used: number;
  lastUsed: string; // YYYY-MM-DD or ""
}

export function listPrompts(plugin: InkwellPlugin): Prompt[] {
  const { app } = plugin;
  const folder = app.vault.getAbstractFileByPath(normalizePath(plugin.settings.folders.prompts));
  if (!(folder instanceof TFolder)) return [];
  const out: Prompt[] = [];
  const walk = (f: TFolder) => {
    for (const c of f.children) {
      if (c instanceof TFolder) walk(c);
      else if (c instanceof TFile && c.extension === "md") {
        const fm = fmOf(app, c);
        if (fm?.type && fm.type !== "prompt") continue;
        out.push({ file: c, used: Number(fm?.used) || 0, lastUsed: fmDay(fm?.last_used) });
      }
    }
  };
  walk(folder);
  return out;
}

/** Least used first, then oldest last_used (never-used first); random among exact ties. */
export function rankPrompts(prompts: Prompt[]): Prompt[] {
  return prompts
    .map((p) => ({ p, r: Math.random() }))
    .sort((a, b) => a.p.used - b.p.used || a.p.lastUsed.localeCompare(b.p.lastUsed) || a.r - b.r)
    .map((x) => x.p);
}

/** The prompt's text: first non-empty body line, else the note name. */
export async function promptText(app: App, file: TFile): Promise<string> {
  const body = (await app.vault.cachedRead(file)).replace(/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/, "");
  const line = body.split("\n").map((l) => l.replace(/^#+\s*/, "").trim()).find(Boolean);
  return line ?? file.basename;
}

export async function markPromptUsed(app: App, file: TFile): Promise<void> {
  await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
    fm.used = (Number(fm.used) || 0) + 1;
    fm.last_used = moment().format("YYYY-MM-DD");
  });
}

export async function newPrompt(plugin: InkwellPlugin): Promise<void> {
  const v = await askForm(plugin.app, "New prompt", [
    { key: "text", label: "Prompt", required: true },
    { key: "tags", label: "Tags", placeholder: "comma-separated, optional" },
  ]);
  if (!v) return;
  const name = cleanName(slugWords(v.text, 10, 80)) || "Prompt";
  const path = uniquePath(plugin.app, plugin.settings.folders.prompts, name);
  await createNote(plugin.app, path, v.text + "\n", {
    type: "prompt",
    tags: v.tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean),
    used: 0,
    last_used: "",
    created: moment().format("YYYY-MM-DD"),
  });
  new Notice("Prompt saved");
}

/** Shows a ranked prompt with "Start exercise" / "Another". */
export class RandomPromptModal extends Modal {
  private ranked: Prompt[];
  private i = 0;

  constructor(private plugin: InkwellPlugin, private onStart: (p: Prompt) => void) {
    super(plugin.app);
    this.ranked = rankPrompts(listPrompts(plugin));
  }

  onOpen() {
    this.setTitle("Prompt");
    void this.show();
  }

  private async show() {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.ranked.length) {
      contentEl.createEl("p", { text: `No prompts yet in "${this.plugin.settings.folders.prompts}". Use "Inkwell: New prompt" to add some.` });
      return;
    }
    const p = this.ranked[this.i % this.ranked.length];
    if (!p) return;
    contentEl.createEl("p", { cls: "inkwell-prompt-text", text: await promptText(this.app, p.file) });
    contentEl.createEl("p", {
      cls: "setting-item-description",
      text: `Used ${p.used}× · ${p.lastUsed ? "last " + moment(p.lastUsed).fromNow() : "never used"}`,
    });
    new Setting(contentEl)
      .addButton((b) =>
        b.setButtonText("Start exercise").setCta().onClick(() => {
          this.close();
          this.onStart(p);
        })
      )
      .addButton((b) =>
        b.setButtonText("Another").onClick(() => {
          this.i++;
          void this.show();
        })
      )
      .addButton((b) =>
        b.setButtonText("Open note").onClick(() => {
          this.close();
          void this.app.workspace.getLeaf(false).openFile(p.file);
        })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

/** Writes a Prompts.base table into the prompts folder (never overwrites). */
export async function createPromptsBase(plugin: InkwellPlugin): Promise<void> {
  const folder = normalizePath(plugin.settings.folders.prompts);
  const path = `${folder}/Prompts.base`;
  const existing = plugin.app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await plugin.app.workspace.getLeaf(false).openFile(existing);
    return;
  }
  await ensureFolder(plugin.app, folder);
  const base = `filters:
  and:
    - file.inFolder("${folder}")
    - type == "prompt"
views:
  - type: table
    name: Prompts
    order:
      - file.name
      - tags
      - used
      - last_used
    sort:
      - property: used
        direction: ASC
      - property: last_used
        direction: ASC
`;
  const file = await plugin.app.vault.create(path, base);
  await plugin.app.workspace.getLeaf(false).openFile(file);
}

/** Same prompt all day (stored in settings); does not count as "used" until exercised. */
export async function promptOfTheDay(plugin: InkwellPlugin): Promise<Prompt | null> {
  const today = moment().format("YYYY-MM-DD");
  const all = listPrompts(plugin);
  const saved = plugin.settings.promptOfDay;
  if (saved?.date === today) {
    const p = all.find((x) => x.file.path === saved.path);
    if (p) return p;
  }
  const top = rankPrompts(all)[0];
  if (!top) return null;
  plugin.settings.promptOfDay = { date: today, path: top.file.path };
  await plugin.saveSettings();
  return top;
}

/** ```inkwell-prompt``` — prompt of the day with Start / Another buttons. */
export function registerPromptBlock(plugin: InkwellPlugin, onStart: (p: Prompt) => void): void {
  plugin.registerMarkdownCodeBlockProcessor("inkwell-prompt", (_src, el, ctx) => {
    const child = new MarkdownRenderChild(el);
    ctx.addChild(child);
    let offset = 0;
    const draw = async () => {
      el.empty();
      const box = el.createDiv({ cls: "inkwell-prompt-block" });
      const today = await promptOfTheDay(plugin);
      if (!today) {
        box.createEl("p", { text: "No prompts yet — add some with \"Inkwell: New prompt\"." });
        return;
      }
      const ranked = [today, ...rankPrompts(listPrompts(plugin)).filter((p) => p.file.path !== today.file.path)];
      const p = ranked[offset % ranked.length];
      if (!p) return;
      box.createDiv({ cls: "inkwell-prompt-label", text: offset === 0 ? "Prompt of the day" : "Another prompt" });
      const text = box.createEl("p", { cls: "inkwell-prompt-text", text: await promptText(plugin.app, p.file) });
      text.onclick = () => plugin.app.workspace.getLeaf(false).openFile(p.file);
      const row = box.createDiv({ cls: "inkwell-prompt-actions" });
      row.createEl("button", { text: "Start exercise", cls: "mod-cta" }).onclick = () => onStart(p);
      row.createEl("button", { text: "Another" }).onclick = () => {
        offset++;
        void draw();
      };
    };
    void draw();
  });
}
