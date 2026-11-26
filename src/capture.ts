import { App, Modal, moment, Notice, Platform, Setting } from "obsidian";
import type InkwellPlugin from "./main";
import { logCaptureInJournal } from "./journal";
import { createResource, isResourceKind, MORE_RESOURCE_KINDS, RESOURCE_KINDS, RESOURCE_LABELS, type ResourceKind } from "./resources";
import { createNote, slugWords, uniquePath } from "./util";

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

const IDEA_PLACEHOLDER = "Type a thought…";
const RESOURCE_PLACEHOLDER = "Title by author\nA link (optional)\nWhy you saved it (optional)";

export class CaptureModal extends Modal {
  private kind: AnyCaptureKind;
  private text = "";

  /** `resource: true` opens on the last resource kind (the "Capture a resource" command). */
  constructor(app: App, private plugin: InkwellPlugin, opts: { resource?: boolean } = {}) {
    super(app);
    const last = plugin.settings.lastCaptureKind;
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
        input.setAttr("placeholder", isResourceKind(k) ? RESOURCE_PLACEHOLDER : IDEA_PLACEHOLDER);
        input.focus();
      };
      buttons.push(b);
    };

    const ideas = contentEl.createDiv({ cls: "inkwell-capture-kinds" });
    for (const k of CAPTURE_KINDS) chip(ideas, k, KIND_LABELS[k]);

    contentEl.createDiv({ cls: "inkwell-capture-group", text: "Feed the well" });
    const well = contentEl.createDiv({ cls: "inkwell-capture-kinds" });
    const showMore = MORE_RESOURCE_KINDS.includes(this.kind as ResourceKind);
    for (const k of RESOURCE_KINDS) {
      if (!showMore && MORE_RESOURCE_KINDS.includes(k)) continue;
      chip(well, k, RESOURCE_LABELS[k]);
    }
    if (!showMore) {
      const more = well.createEl("button", { text: "More…", cls: "inkwell-capture-more" });
      more.onclick = () => {
        more.remove();
        for (const k of MORE_RESOURCE_KINDS) chip(well, k, RESOURCE_LABELS[k]);
        input.focus();
      };
    }

    const input = contentEl.createEl("textarea", {
      cls: "inkwell-capture-input",
      attr: { rows: "5", placeholder: isResourceKind(this.kind) ? RESOURCE_PLACEHOLDER : IDEA_PLACEHOLDER },
    });
    input.addEventListener("input", () => (this.text = input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void this.submit();
      }
    });

    new Setting(contentEl)
      .setDesc(Platform.isMobile ? "" : "⌘/Ctrl + Enter to save")
      .addButton((b) => b.setButtonText("Save").setCta().onClick(() => void this.submit()));

    window.setTimeout(() => input.focus(), 0);
  }

  private async submit() {
    if (!this.text.trim()) {
      this.close();
      return;
    }
    try {
      if (isResourceKind(this.kind)) await createResource(this.plugin, this.kind, this.text);
      else await saveCapture(this.plugin, this.kind, this.text);
      this.plugin.settings.lastCaptureKind = this.kind;
      await this.plugin.saveSettings();
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
