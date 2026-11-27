import { describe, expect, it } from "vitest";
import { applyControlValue, controlValue, DEFAULT_SETTINGS, mergeSettings } from "../src/settings";

const fresh = () => mergeSettings({}).settings;

describe("mergeSettings", () => {
  it("fills in defaults for a new install", () => {
    const { settings, legacy } = mergeSettings(null);
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(legacy).toBeNull();
  });

  it("keeps saved values and fills missing nested ones", () => {
    const { settings } = mergeSettings({ folders: { inbox: "Inbox" }, exerciseMinutes: 20 });
    expect(settings.folders.inbox).toBe("Inbox");
    expect(settings.folders.journal).toBe(DEFAULT_SETTINGS.folders.journal);
    expect(settings.exerciseMinutes).toBe(20);
  });

  it("uses the old exercises folder as the exercise writing folder", () => {
    const { settings } = mergeSettings({ folders: { exercises: "Practice/Old" } });
    expect(settings.folders.writings).toBe("Practice/Old");
    expect(settings.folders).not.toHaveProperty("exercises");
  });

  it("prefers an explicit writings folder over the old exercises one", () => {
    const { settings } = mergeSettings({ folders: { exercises: "Old", writings: "New" } });
    expect(settings.folders.writings).toBe("New");
  });

  it("pulls device-local state out of the synced settings", () => {
    const timer = { path: "Ex.md" };
    const { settings, legacy } = mergeSettings({ timer, lastCaptureKind: "poem" });
    expect(legacy).toEqual({ timer, lastCaptureKind: "poem" });
    expect(settings).not.toHaveProperty("timer");
    expect(settings).not.toHaveProperty("lastCaptureKind");
  });

  it("defaults the word log folder and the week start, and ignores a week start it can't read", () => {
    const { settings } = mergeSettings({ weekStart: "someday" });
    expect(settings.folders.wordLog).toBe("99 - System/Inkwell/Word log");
    expect(settings.weekStart).toBe("monday");
    expect(mergeSettings({ weekStart: "sunday" }).settings.weekStart).toBe("sunday");
  });

  it("never shares status lists with the defaults", () => {
    const { settings } = mergeSettings({});
    settings.shortStatuses.push("abandoned");
    expect(DEFAULT_SETTINGS.shortStatuses).not.toContain("abandoned");
  });
});

describe("settings controls", () => {
  it("trims folders and falls back to the default when emptied", () => {
    const s = fresh();
    expect(applyControlValue(s, "folders.inbox", "  My Inbox  ")).toBe(true);
    expect(s.folders.inbox).toBe("My Inbox");
    applyControlValue(s, "folders.inbox", "   ");
    expect(s.folders.inbox).toBe(DEFAULT_SETTINGS.folders.inbox);
  });

  it("lets a template path be cleared (built-in template)", () => {
    const s = fresh();
    applyControlValue(s, "templates.journal", "");
    expect(s.templates.journal).toBe("");
  });

  it("keeps counts whole and never negative", () => {
    const s = fresh();
    applyControlValue(s, "defaultSceneTarget", 812.6);
    expect(s.defaultSceneTarget).toBe(813);
    applyControlValue(s, "defaultSceneTarget", -50);
    expect(s.defaultSceneTarget).toBe(0);
    applyControlValue(s, "timerIdleMinutes", "abc");
    expect(s.timerIdleMinutes).toBe(0);
  });

  it("never sets the exercise goal to zero", () => {
    const s = fresh();
    applyControlValue(s, "exerciseMinutes", 0);
    expect(s.exerciseMinutes).toBe(DEFAULT_SETTINGS.exerciseMinutes);
  });

  it("edits status lists as comma-separated text", () => {
    const s = fresh();
    expect(controlValue(s, "shortStatuses")).toBe("idea, drafting, revising, done");
    applyControlValue(s, "shortStatuses", " idea ,draft,, done ");
    expect(s.shortStatuses).toEqual(["idea", "draft", "done"]);
    applyControlValue(s, "shortStatuses", " , ");
    expect(s.shortStatuses).toEqual(DEFAULT_SETTINGS.shortStatuses);
  });

  it("keeps the week start to a weekday", () => {
    const s = fresh();
    applyControlValue(s, "weekStart", "sunday");
    expect(s.weekStart).toBe("sunday");
    expect(controlValue(s, "weekStart")).toBe("sunday");
    applyControlValue(s, "weekStart", "Funday");
    expect(s.weekStart).toBe("monday");
    applyControlValue(s, "folders.wordLog", "  ");
    expect(s.folders.wordLog).toBe(DEFAULT_SETTINGS.folders.wordLog);
  });

  it("reads toggles strictly", () => {
    const s = fresh();
    applyControlValue(s, "captureToJournal", "yes");
    expect(s.captureToJournal).toBe(false);
    applyControlValue(s, "captureToJournal", true);
    expect(s.captureToJournal).toBe(true);
  });

  it("ignores unknown keys", () => {
    const s = fresh();
    expect(applyControlValue(s, "folders.nope", "x")).toBe(false);
    expect(applyControlValue(s, "bogus", 1)).toBe(false);
    expect(s).toEqual(fresh());
  });

  it("reads nested and top-level values", () => {
    const s = fresh();
    expect(controlValue(s, "folders.prompts")).toBe(DEFAULT_SETTINGS.folders.prompts);
    expect(controlValue(s, "timerAutoStart")).toBe(true);
    expect(controlValue(s, "folders.nope")).toBeUndefined();
  });
});
