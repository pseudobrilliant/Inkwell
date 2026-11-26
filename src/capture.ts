import { App, Modal, moment, Notice, Platform, Setting } from "obsidian";
import type InkwellPlugin from "./main";
import { logCaptureInJournal } from "./journal";
import {
  createResource,
  isResourceKind,
  RESOURCE_FIELDS,
  RESOURCE_KINDS,
  RESOURCE_LABELS,
  type ResourceKind,
  type ResourceValues,
} from "./resources";
import { createNote, slugWords, uniquePath } from "./util";

/** Device-local storage key for the last kind picked in the popup (an idea kind or a resource kind). */
export const LAST_KIND_KEY = "inkwell-last-capture-kind";

export const CAPTURE_KINDS = ["idea", "line", "link", "prompt", "research"] as const;
export type CaptureKind = (typeof CAPTURE_KINDS)[number];
/** Everything the capture popup can save: your own ideas (Inbox) or others' work (Resources). */
export type AnyCaptureKind = CaptureKind | ResourceKind;

export function isCaptureKind(k: unknown): k is CaptureKind {
  return typeof k === "string" && (CAPTURE_KINDS as readonly string[]).includes(k);
}

const KIND_LABELS: Record<CaptureKind, string> = {
  idea: "Idea",
  line: "Line / snippet",
  link: "Image / link",
  prompt: "Prompt",
  research: "Research",
};

export async function saveCapture(plugin: InkwellPlugin, kind: CaptureKind, text: string): Promise<void> {
  const now = moment();
  const words = slugWords(text) || kind;
  const name = `${now.format("YYYY-MM-DD HHmm")} ${words}`;
  const path = uniquePath(plugin.app, plugin.settings.folders.inbox, name);
  const file = await createNote(plugin.app, path, text.trim() + "\n", {
    type: "capture",
    kind,
    created: now.format("YYYY-MM-DDTHH:mm"),
    // Kept through triage (prompt, resource, story notes…) so captures still count as contribution.
    captured: now.format("YYYY-MM-DD"),
    source: Platform.isMobile ? "mobile" : "desktop",
  });
  await logCaptureInJournal(plugin, file, kind);
}

export class CaptureModal extends Modal {
  private kind: AnyCaptureKind;
  private text = "";
  /** Resource fields, kept while switching kinds so a title typed under Book survives a switch to Poem. */
  private values: ResourceValues = {};

  /** `resource: true` opens on the last resource kind (the "Capture a resource" command). */
  constructor(app: App, private plugin: InkwellPlugin, opts: { resource?: boolean } = {}) {
    super(app);
    const last: unknown = app.loadLocalStorage(LAST_KIND_KEY);
    if (opts.resource) this.kind = isResourceKind(last) ? last : "article";
    else this.kind = isCaptureKind(last) || isResourceKind(last) ? last : "idea";
  }

  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass("inkwell-capture");
    this.setTitle("Capture");

    const buttons: HTMLButtonElement[] = [];
    const chip = (row: HTMLElement, k: AnyCaptureKind, label: string) => {
      const b = row.createEl("button", { text: label });
      if (k === this.kind) b.addClass("is-active");
      b.onclick = () => {
        this.kind = k;
        buttons.forEach((x) => x.removeClass("is-active"));
        b.addClass("is-active");
        this.renderInput(body);
      };
      buttons.push(b);
    };

    const ideas = contentEl.createDiv({ cls: "inkwell-capture-kinds" });
    for (const k of CAPTURE_KINDS) chip(ideas, k, KIND_LABELS[k]);

    contentEl.createDiv({ cls: "inkwell-capture-group", text: "Feed the well" });
    const well = contentEl.createDiv({ cls: "inkwell-capture-kinds" });
    for (const k of RESOURCE_KINDS) chip(well, k, RESOURCE_LABELS[k]);

    const body = contentEl.createDiv();
    this.renderInput(body);

    new Setting(contentEl)
      .setDesc(Platform.isMobile ? "" : "⌘/Ctrl + Enter to save")
      .addButton((b) => b.setButtonText("Save").setCta().onClick(() => void this.submit()));
  }

  /** ⌘/Ctrl + Enter saves from any field. */
  private saveOnModEnter(el: HTMLElement) {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void this.submit();
      }
    });
  }

  /** A textarea for your own ideas; the kind's own fields for a resource. */
  private renderInput(body: HTMLElement) {
    body.empty();
    let first: HTMLElement | null = null;
    if (!isResourceKind(this.kind)) {
      const input = body.createEl("textarea", {
        cls: "inkwell-capture-input",
        attr: { rows: "5", placeholder: "Type a thought…" },
      });
      input.value = this.text;
      input.addEventListener("input", () => (this.text = input.value));
      this.saveOnModEnter(input);
      first = input;
    } else {
      const form = body.createDiv({ cls: "inkwell-capture-fields" });
      for (const f of RESOURCE_FIELDS[this.kind]) {
        const id = `inkwell-capture-${f.key}`;
        form.createEl("label", { text: f.label, attr: { for: id } });
        const attr = { id, placeholder: f.placeholder ?? "" };
        const input =
          f.multiline
            ? form.createEl("textarea", { cls: "inkwell-capture-text", attr: { ...attr, rows: "6" } })
            : form.createEl("input", { type: f.date ? "date" : f.key === "url" ? "url" : "text", attr });
        input.value = this.values[f.key] ?? "";
        input.addEventListener("input", () => (this.values[f.key] = input.value));
        this.saveOnModEnter(input);
        // Enter in a one-line field moves to the next field (or saves from the last one).
        if (input instanceof HTMLInputElement) {
          input.addEventListener("keydown", (e) => {
            if (e.key !== "Enter" || e.metaKey || e.ctrlKey || e.isComposing) return;
            e.preventDefault();
            const fields = Array.from(form.querySelectorAll<HTMLElement>("input, textarea"));
            const next = fields[fields.indexOf(input) + 1];
            if (next) next.focus();
            else void this.submit();
          });
        }
        first ??= input;
      }
    }
    window.setTimeout(() => first?.focus(), 0);
  }

  private async submit() {
    const resource = isResourceKind(this.kind);
    const empty = resource ? !Object.values(this.values).some((v) => v?.trim()) : !this.text.trim();
    if (empty) {
      this.close();
      return;
    }
    try {
      if (isResourceKind(this.kind)) await createResource(this.plugin, this.kind, this.values);
      else await saveCapture(this.plugin, this.kind, this.text);
      this.app.saveLocalStorage(LAST_KIND_KEY, this.kind);
      new Notice(isResourceKind(this.kind) ? "Added to resources" : "Captured to inbox");
      this.close();
    } catch (e) {
      console.error("Inkwell capture failed", e);
      new Notice(`Capture failed: ${(e as Error).message}`);
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
