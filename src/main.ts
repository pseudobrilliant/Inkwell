import { debounce, Plugin, TFile } from "obsidian";
import { DEFAULT_SETTINGS, InkwellSettings, InkwellSettingTab } from "./settings";
import { CaptureModal } from "./capture";
import { writeDefaultTemplates } from "./templates";
import { openTodaysJournal } from "./journal";
import { formatProgress, newCodexNote, newShortStory, showStoryProgress, storyForFile, storyProgress } from "./stories";
import { createPromptsBase, newPrompt, RandomPromptModal } from "./prompts";
import { createExercise, newExercise } from "./exercise";

export default class InkwellPlugin extends Plugin {
  settings!: InkwellSettings;
  private statusEl: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new InkwellSettingTab(this.app, this));

    // Capture
    const capture = () => new CaptureModal(this.app, this).open();
    this.addCommand({ id: "quick-capture", name: "Quick capture", callback: capture });
    this.addRibbonIcon("feather", "Inkwell: quick capture", capture);

    // Practice
    this.addCommand({ id: "todays-journal", name: "Open today's journal", callback: () => openTodaysJournal(this) });
    this.addCommand({ id: "new-exercise", name: "New exercise", callback: () => newExercise(this) });
    this.addCommand({
      id: "random-prompt",
      name: "Random prompt",
      callback: () => new RandomPromptModal(this, (p) => void createExercise(this, p)).open(),
    });
    this.addCommand({ id: "new-prompt", name: "New prompt", callback: () => newPrompt(this) });
    this.addCommand({ id: "prompts-table", name: "Open prompts table", callback: () => createPromptsBase(this) });

    // Short form
    this.addCommand({ id: "new-short-story", name: "New short story", callback: () => newShortStory(this) });
    this.addCommand({ id: "story-progress", name: "Story progress", callback: () => showStoryProgress(this) });
    this.addCommand({ id: "new-character", name: "New character", callback: () => newCodexNote(this, "character") });
    this.addCommand({ id: "new-location", name: "New location", callback: () => newCodexNote(this, "location") });

    // Setup
    this.addCommand({
      id: "write-default-templates",
      name: "Write default templates",
      callback: () => writeDefaultTemplates(this.app, this.settings),
    });

    // Story progress in the status bar (desktop only; mobile has no status bar).
    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass("mod-clickable");
    this.statusEl.onClickEvent(() => showStoryProgress(this));
    const refresh = debounce(() => this.refreshStatusBar(), 1000, true);
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refreshStatusBar()));
    this.registerEvent(this.app.vault.on("modify", (f) => f instanceof TFile && refresh()));
    this.registerEvent(this.app.metadataCache.on("changed", () => refresh()));
    this.app.workspace.onLayoutReady(() => this.refreshStatusBar());
  }

  async refreshStatusBar() {
    if (!this.statusEl) return;
    const story = storyForFile(this, this.app.workspace.getActiveFile());
    if (!story) {
      this.statusEl.setText("");
      this.statusEl.hide();
      return;
    }
    const p = await storyProgress(this, story);
    this.statusEl.setText(`${story.name} · ${formatProgress(p)}${p.status ? " · " + p.status : ""}`);
    this.statusEl.show();
  }

  async loadSettings() {
    const data = (await this.loadData()) ?? {};
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...data,
      folders: { ...DEFAULT_SETTINGS.folders, ...data.folders },
      templates: { ...DEFAULT_SETTINGS.templates, ...data.templates },
    };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
