import { App, PluginSettingTab, type SettingDefinition, type SettingDefinitionItem } from "obsidian";
import type InkwellPlugin from "./main";
import type { TimerState } from "./timer";

export interface InkwellSettings {
  folders: {
    inbox: string;
    writing: string;
    longProjects: string;
    journal: string;
    /** Exercise notes (the writing done in practice), under Exercises next to prompts and drills. */
    writings: string;
    prompts: string;
    drills: string;
    resources: string;
  };
  templates: {
    home: string;
    journal: string;
    exercise: string;
    drill: string;
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
  journalMinutes: number;
  timerAutoStart: boolean;
  timerIdleMinutes: number;
  defaultShortTarget: number;
  defaultLongTarget: number;
  defaultSceneTarget: number;
  captureToJournal: boolean;
  promptOfDay?: { date: string; path: string };
  /** The running writing timer (src/timer.ts), kept here so it survives a reload. */
  timer?: TimerState;
}

export const DEFAULT_SETTINGS: InkwellSettings = {
  folders: {
    inbox: "00 - Inbox",
    journal: "01 - Practice/Journal",
    writings: "01 - Practice/Exercises/Writing",
    prompts: "01 - Practice/Exercises/Prompts",
    drills: "01 - Practice/Exercises/Drills",
    writing: "02 - Stories",
    longProjects: "03 - Projects",
    resources: "05 - Resources",
  },
  templates: {
    home: "99 - System/Templates/Inkwell/Home.md",
    journal: "99 - System/Templates/Inkwell/Journal.md",
    exercise: "99 - System/Templates/Inkwell/Exercise.md",
    drill: "99 - System/Templates/Inkwell/Drill.md",
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
  journalMinutes: 10,
  timerAutoStart: true,
  timerIdleMinutes: 5,
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
  writings: "Exercise writing",
  prompts: "Prompts",
  drills: "Drills",
  writing: "Stories",
  longProjects: "Projects",
  resources: "Resources",
};

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  home: "Home dashboard",
  journal: "Journal",
  exercise: "Exercise",
  drill: "Drill",
  storyHub: "Short story hub",
  storyDraft: "Short story draft",
  projectHub: "Project",
  character: "Character",
  location: "Location",
};

/** Keys of the settings tab's controls. Nested settings use dotted paths (`folders.inbox`). */
type ControlKey =
  | `folders.${FolderKey}`
  | `templates.${TemplateKey}`
  | "homeNote"
  | "captureToJournal"
  | "journalDateFormat"
  | "exerciseMinutes"
  | "journalMinutes"
  | "timerAutoStart"
  | "timerIdleMinutes"
  | "defaultShortTarget"
  | "defaultLongTarget"
  | "defaultSceneTarget"
  | "shortStatuses"
  | "longStatuses";

const STATUS_KEYS = ["shortStatuses", "longStatuses"] as const;
const TARGET_KEYS = ["defaultShortTarget", "defaultLongTarget", "defaultSceneTarget"] as const;

const asText = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const asCount = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);

/**
 * Declarative settings tab (Obsidian 1.13+), so every Inkwell setting shows up in Obsidian's settings search.
 * Values are read and written through getControlValue/setControlValue, which keep the normalization rules:
 * text is trimmed, empty paths fall back to defaults, and status lists are edited as comma-separated text.
 */
export class InkwellSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: InkwellPlugin) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem<ControlKey>[] {
    const ktr = this.plugin.ktr.status();
    const number = (name: string, desc: string, key: ControlKey, min = 0): SettingDefinition<ControlKey> => ({
      name,
      desc,
      control: { type: "number", key, min, step: 1 },
    });
    return [
      {
        type: "group",
        heading: "Folders",
        items: (Object.keys(FOLDER_LABELS) as FolderKey[]).map((key) => ({
          name: FOLDER_LABELS[key],
          control: { type: "folder", key: `folders.${key}`, placeholder: DEFAULT_SETTINGS.folders[key] },
        })),
      },
      {
        type: "group",
        heading: "Home",
        items: [
          {
            name: "Home note",
            desc: "The dashboard note that the open home command opens. It is created from the home template if missing and never overwritten.",
            control: { type: "file", key: "homeNote", placeholder: DEFAULT_SETTINGS.homeNote, filter: (f) => f.extension === "md" },
          },
        ],
      },
      {
        type: "group",
        heading: "Templates",
        items: [
          {
            name: "Missing templates",
            desc: "If a template file is missing, Inkwell uses its built-in version. The write default templates command creates editable copies.",
          },
          ...(Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map(
            (key): SettingDefinition<ControlKey> => ({
              name: TEMPLATE_LABELS[key],
              aliases: ["template"],
              control: { type: "file", key: `templates.${key}`, placeholder: "Path to a template note", filter: (f) => f.extension === "md" },
            })
          ),
        ],
      },
      {
        type: "group",
        heading: "Capture",
        items: [
          {
            name: "Also log captures in today's journal",
            desc: "Adds a linked line under the captures heading in today's journal.",
            control: { type: "toggle", key: "captureToJournal" },
          },
        ],
      },
      {
        type: "group",
        heading: "Journal",
        items: [
          {
            name: "Date format",
            desc: "Moment.js format for journal note names.",
            control: { type: "text", key: "journalDateFormat", placeholder: DEFAULT_SETTINGS.journalDateFormat },
          },
        ],
      },
      {
        type: "group",
        heading: "Writing timer",
        items: [
          {
            name: "Time practice writing",
            desc: "New exercises (including ones from a random prompt) and today's journal get a timer that starts on your first keystroke. Stopping it adds the minutes to the note's writing_min.",
            aliases: ["sprint", "minutes"],
            control: { type: "toggle", key: "timerAutoStart" },
          },
          number("Exercise goal (minutes)", "Pre-filled when creating an exercise.", "exerciseMinutes", 1),
          number("Journal goal (minutes)", "A notice appears when you reach it. 0 = no goal.", "journalMinutes"),
          number("Pause after (minutes without typing)", "The timer pauses by itself and resumes when you type again. 0 = never.", "timerIdleMinutes"),
        ],
      },
      {
        type: "group",
        heading: "Defaults",
        items: [
          number("Short story word target", "Pre-filled when creating a story. 0 = none.", "defaultShortTarget"),
          number("Project word target", "Pre-filled when creating a project or promoting a story. 0 = none.", "defaultLongTarget"),
          number("Scene word target", "The word target for new scenes. 0 = none.", "defaultSceneTarget"),
        ],
      },
      {
        type: "group",
        heading: "Keep the Rhythm",
        items: [
          {
            name: ktr.ok ? "Connected" : "Not connected",
            desc: ktr.message + " Inkwell only reads it; word stats are hidden without it.",
            aliases: ["word count", "streak", "heatmap"],
          },
        ],
      },
      {
        type: "group",
        heading: "Statuses",
        items: [
          {
            name: "Short form",
            desc: "Comma-separated, in order.",
            control: { type: "text", key: "shortStatuses", placeholder: DEFAULT_SETTINGS.shortStatuses.join(", ") },
          },
          {
            name: "Long form (scenes)",
            desc: "Comma-separated, in order.",
            control: { type: "text", key: "longStatuses", placeholder: DEFAULT_SETTINGS.longStatuses.join(", ") },
          },
        ],
      },
    ];
  }

  getControlValue(key: string): unknown {
    const s = this.plugin.settings;
    const [group, sub] = key.split(".");
    if (group === "folders" && sub && sub in s.folders) return s.folders[sub as FolderKey];
    if (group === "templates" && sub && sub in s.templates) return s.templates[sub as TemplateKey];
    if (key === "shortStatuses" || key === "longStatuses") return s[key].join(", ");
    if (key in s) return s[key as keyof InkwellSettings];
    return undefined;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const s = this.plugin.settings;
    const [group, sub] = key.split(".");
    if (group === "folders" && sub && sub in s.folders) {
      const k = sub as FolderKey;
      s.folders[k] = asText(value) || DEFAULT_SETTINGS.folders[k];
    } else if (group === "templates" && sub && sub in s.templates) {
      s.templates[sub as TemplateKey] = asText(value);
    } else if (key === "homeNote") {
      s.homeNote = asText(value) || DEFAULT_SETTINGS.homeNote;
    } else if (key === "journalDateFormat") {
      s.journalDateFormat = asText(value) || DEFAULT_SETTINGS.journalDateFormat;
    } else if (key === "captureToJournal") {
      s.captureToJournal = value === true;
    } else if (key === "exerciseMinutes") {
      s.exerciseMinutes = asCount(value) || DEFAULT_SETTINGS.exerciseMinutes;
    } else if (key === "journalMinutes" || key === "timerIdleMinutes") {
      s[key] = asCount(value);
    } else if (key === "timerAutoStart") {
      s.timerAutoStart = value === true;
    } else if ((TARGET_KEYS as readonly string[]).includes(key)) {
      s[key as (typeof TARGET_KEYS)[number]] = asCount(value);
    } else if ((STATUS_KEYS as readonly string[]).includes(key)) {
      const k = key as (typeof STATUS_KEYS)[number];
      const list = asText(value).split(",").map((x) => x.trim()).filter(Boolean);
      s[k] = list.length ? list : [...DEFAULT_SETTINGS[k]];
    } else {
      return;
    }
    await this.plugin.saveSettings();
  }
}
