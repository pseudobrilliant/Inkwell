import { App, Modal, moment, Notice, Platform, Setting } from "obsidian";
import type InkwellPlugin from "./main";
import { appendToJournal } from "./journal";
import { createNote, slugWords, uniquePath } from "./util";

export const CAPTURE_KINDS = ["idea", "line", "link", "prompt", "research"] as const;
export type CaptureKind = (typeof CAPTURE_KINDS)[number];

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
    source: Platform.isMobile ? "mobile" : "desktop",
  });
  if (plugin.settings.captureToJournal) {
    try {
      const link = plugin.app.fileManager.generateMarkdownLink(file, plugin.settings.folders.journal);
      await appendToJournal(plugin, "Captures", `- ${now.format("HH:mm")} ${link} (${kind})`);
    } catch (e) {
      console.error("Inkwell: could not log capture in journal", e);
    }
  }
}

export class CaptureModal extends Modal {
  private kind: CaptureKind;
  private text = "";

  constructor(app: App, private plugin: InkwellPlugin) {
    super(app);
    this.kind = plugin.settings.lastCaptureKind;
  }

  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass("inkwell-capture");
    this.setTitle("Capture");

    const kinds = contentEl.createDiv({ cls: "inkwell-capture-kinds" });
    const buttons: HTMLButtonElement[] = [];
    for (const k of CAPTURE_KINDS) {
      const b = kinds.createEl("button", { text: KIND_LABELS[k] });
      if (k === this.kind) b.addClass("is-active");
      b.onclick = () => {
        this.kind = k;
        buttons.forEach((x) => x.removeClass("is-active"));
        b.addClass("is-active");
        input.focus();
      };
      buttons.push(b);
    }

    const input = contentEl.createEl("textarea", {
      cls: "inkwell-capture-input",
      attr: { rows: "5", placeholder: "Type a thought…" },
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
      await saveCapture(this.plugin, this.kind, this.text);
      this.plugin.settings.lastCaptureKind = this.kind;
      await this.plugin.saveSettings();
      new Notice("Captured to Inbox");
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
