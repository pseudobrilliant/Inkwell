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
    home: string;
    journal: string;
    exercise: string;
    storyHub: string;
    storyDraft: string;
    projectHub: string;
    character: string;
    location: string;
  };
  homeNote: string;
  journalDateFormat: string;
  shortStatuses: string[];
  longStatuses: string[];
  lastCaptureKind: "idea" | "line" | "link" | "prompt" | "research";
  exerciseMinutes: number;
  defaultShortTarget: number;
  defaultLongTarget: number;
  defaultSceneTarget: number;
  captureToJournal: boolean;
  promptOfDay?: { date: string; path: string };
}

export const DEFAULT_SETTINGS: InkwellSettings = {
  folders: {
    inbox: "00 - Inbox",
    journal: "01 - Practice/Journal",
    exercises: "01 - Practice/Exercises",
    prompts: "01 - Practice/Prompts",
    writing: "02 - Stories",
    longProjects: "03 - Projects",
    resources: "05 - Resources",
  },
  templates: {
    home: "99 - System/Templates/Inkwell/Home.md",
    journal: "99 - System/Templates/Inkwell/Journal.md",
    exercise: "99 - System/Templates/Inkwell/Exercise.md",
    storyHub: "99 - System/Templates/Inkwell/Story.md",
    storyDraft: "99 - System/Templates/Inkwell/Story Draft.md",
    projectHub: "99 - System/Templates/Inkwell/Project.md",
    character: "99 - System/Templates/Inkwell/Character.md",
    location: "99 - System/Templates/Inkwell/Location.md",
  },
  homeNote: "00 - Home/00 - Home.md",
  journalDateFormat: "YYYY-MM-DD",
  shortStatuses: ["idea", "drafting", "revising", "done"],
  // StoryLine's scene statuses
  longStatuses: ["idea", "outlined", "draft", "written", "revised", "final"],
  lastCaptureKind: "idea",
  exerciseMinutes: 15,
  defaultShortTarget: 0,
  defaultLongTarget: 0,
  defaultSceneTarget: 800,
  captureToJournal: false,
};

type FolderKey = keyof InkwellSettings["folders"];
type TemplateKey = keyof InkwellSettings["templates"];

const FOLDER_LABELS: Record<FolderKey, string> = {
  inbox: "Inbox",
  journal: "Journal",
  exercises: "Exercises",
  prompts: "Prompts",
  writing: "Stories",
  longProjects: "Projects",
  resources: "Resources",
};

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  home: "Home dashboard",
  journal: "Journal",
  exercise: "Exercise",
  storyHub: "Short story hub",
  storyDraft: "Short story draft",
  projectHub: "Project",
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
      .setName("Home note")
      .setDesc("The dashboard note that the open home command opens. It is created from the home template if missing and never overwritten.")
      .addText((t) =>
        t.setValue(s.homeNote).onChange(async (v) => {
          s.homeNote = v.trim() || DEFAULT_SETTINGS.homeNote;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Templates")
      .setDesc("Paths to template notes. If a file is missing, Inkwell uses its built-in version. The write default templates command creates editable copies.")
      .setHeading();
    for (const key of Object.keys(TEMPLATE_LABELS) as TemplateKey[]) {
      new Setting(containerEl).setName(TEMPLATE_LABELS[key]).addText((t) =>
        t
          .setPlaceholder("Path to a template note")
          .setValue(s.templates[key])
          .onChange(async (v) => {
            s.templates[key] = v.trim();
            await this.plugin.saveSettings();
          })
      );
    }

    new Setting(containerEl).setName("Capture").setHeading();
    new Setting(containerEl)
      .setName("Also log captures in today's journal")
      .setDesc("Adds a linked line under the captures heading in today's journal.")
      .addToggle((t) =>
        t.setValue(s.captureToJournal).onChange(async (v) => {
          s.captureToJournal = v;
          await this.plugin.saveSettings();
        })
      );

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

    const num = (name: string, desc: string, key: "defaultLongTarget" | "defaultSceneTarget") =>
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addText((t) => {
          t.inputEl.type = "number";
          t.setValue(String(s[key])).onChange(async (v) => {
            s[key] = Math.max(0, parseInt(v, 10) || 0);
            await this.plugin.saveSettings();
          });
        });
    num("Project word target", "Pre-filled when creating a project or promoting a story. 0 = none.", "defaultLongTarget");
    num("Scene word target", "target_wordcount for new scenes. 0 = none.", "defaultSceneTarget");

    new Setting(containerEl).setName("Keep the Rhythm").setHeading();
    const ktr = this.plugin.ktr.status();
    new Setting(containerEl)
      .setName(ktr.ok ? "Connected" : "Not connected")
      .setDesc(ktr.message + " Inkwell only reads it; word stats are hidden without it.");

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
    statusSetting("Long form (scenes)", "longStatuses");
  }
}
