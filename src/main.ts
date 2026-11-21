import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, InkwellSettings, InkwellSettingTab } from "./settings";
import { CaptureModal } from "./capture";
import { writeDefaultTemplates } from "./templates";

export default class InkwellPlugin extends Plugin {
  settings!: InkwellSettings;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new InkwellSettingTab(this.app, this));

    this.addCommand({
      id: "quick-capture",
      name: "Quick capture",
      callback: () => new CaptureModal(this.app, this).open(),
    });
    this.addRibbonIcon("feather", "Inkwell: quick capture", () => new CaptureModal(this.app, this).open());

    this.addCommand({
      id: "write-default-templates",
      name: "Write default templates",
      callback: () => writeDefaultTemplates(this.app, this.settings),
    });
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
