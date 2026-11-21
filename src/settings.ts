import { App, PluginSettingTab, Setting } from "obsidian";
import type InkwellPlugin from "./main";

export interface InkwellSettings {
  folders: {
    inbox: string;
    writing: string;
    longProjects: string;
    journal: string;
    exercises: string;
    prompts: string;
    resources: string;
  };
  templates: {
    journal: string;
    exercise: string;
    storyHub: string;
    storyDraft: string;
    character: string;
    location: string;
  };
  journalDateFormat: string;
  shortStatuses: string[];
  longStatuses: string[];
  lastCaptureKind: "idea" | "line" | "link" | "prompt" | "research";
  exerciseMinutes: number;
  defaultShortTarget: number;
}

export const DEFAULT_SETTINGS: InkwellSettings = {
  folders: {
    inbox: "00 - Inbox",
    writing: "01 - Writing",
    longProjects: "02 - Long Projects",
    journal: "04 - Practice/Journal",
    exercises: "04 - Practice/Exercises",
    prompts: "04 - Practice/Prompts",
    resources: "05 - Resources",
  },
  templates: {
    journal: "99 - System/Templates/Inkwell/Journal.md",
    exercise: "99 - System/Templates/Inkwell/Exercise.md",
    storyHub: "99 - System/Templates/Inkwell/Story.md",
    storyDraft: "99 - System/Templates/Inkwell/Story Draft.md",
    character: "99 - System/Templates/Inkwell/Character.md",
    location: "99 - System/Templates/Inkwell/Location.md",
  },
  journalDateFormat: "YYYY-MM-DD",
  shortStatuses: ["idea", "drafting", "revising", "done"],
  longStatuses: ["idea", "outlining", "drafting", "revising", "done"],
  lastCaptureKind: "idea",
  exerciseMinutes: 15,
  defaultShortTarget: 0,
};

type FolderKey = keyof InkwellSettings["folders"];
type TemplateKey = keyof InkwellSettings["templates"];

const FOLDER_LABELS: Record<FolderKey, string> = {
  inbox: "Inbox",
  writing: "Short stories",
  longProjects: "Long projects",
  journal: "Journal",
  exercises: "Exercises",
  prompts: "Prompts",
  resources: "Resources",
};

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  journal: "Journal",
  exercise: "Exercise",
  storyHub: "Short story hub",
  storyDraft: "Short story draft",
  character: "Character",
  location: "Location",
};

export class InkwellSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: InkwellPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;

    new Setting(containerEl).setName("Folders").setHeading();
    for (const key of Object.keys(FOLDER_LABELS) as FolderKey[]) {
      new Setting(containerEl).setName(FOLDER_LABELS[key]).addText((t) =>
        t
          .setPlaceholder(DEFAULT_SETTINGS.folders[key])
          .setValue(s.folders[key])
          .onChange(async (v) => {
            s.folders[key] = v.trim() || DEFAULT_SETTINGS.folders[key];
            await this.plugin.saveSettings();
          })
      );
    }

    new Setting(containerEl)
      .setName("Templates")
      .setDesc("Paths to template notes. If a file is missing, Inkwell uses its built-in version. Run \"Write default templates\" to create editable copies.")
      .setHeading();
    for (const key of Object.keys(TEMPLATE_LABELS) as TemplateKey[]) {
      new Setting(containerEl).setName(TEMPLATE_LABELS[key]).addText((t) =>
        t
          .setPlaceholder("99 - System/Templates/…")
          .setValue(s.templates[key])
          .onChange(async (v) => {
            s.templates[key] = v.trim();
            await this.plugin.saveSettings();
          })
      );
    }

    new Setting(containerEl).setName("Journal").setHeading();
    new Setting(containerEl)
      .setName("Date format")
      .setDesc("Moment.js format for journal note names.")
      .addText((t) =>
        t.setValue(s.journalDateFormat).onChange(async (v) => {
          s.journalDateFormat = v.trim() || DEFAULT_SETTINGS.journalDateFormat;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl).setName("Defaults").setHeading();
    new Setting(containerEl).setName("Exercise timer goal (minutes)").addText((t) => {
      t.inputEl.type = "number";
      t.setValue(String(s.exerciseMinutes)).onChange(async (v) => {
        s.exerciseMinutes = parseInt(v, 10) || DEFAULT_SETTINGS.exerciseMinutes;
        await this.plugin.saveSettings();
      });
    });
    new Setting(containerEl)
      .setName("Short story word target")
      .setDesc("Pre-filled when creating a story. 0 = none.")
      .addText((t) => {
        t.inputEl.type = "number";
        t.setValue(String(s.defaultShortTarget)).onChange(async (v) => {
          s.defaultShortTarget = Math.max(0, parseInt(v, 10) || 0);
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl).setName("Statuses").setHeading();
    const statusSetting = (name: string, key: "shortStatuses" | "longStatuses") =>
      new Setting(containerEl)
        .setName(name)
        .setDesc("Comma-separated, in order.")
        .addText((t) =>
          t.setValue(s[key].join(", ")).onChange(async (v) => {
            const list = v.split(",").map((x) => x.trim()).filter(Boolean);
            s[key] = list.length ? list : DEFAULT_SETTINGS[key];
            await this.plugin.saveSettings();
          })
        );
    statusSetting("Short form", "shortStatuses");
    statusSetting("Long form", "longStatuses");
  }
}
