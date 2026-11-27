import { describe, expect, it } from "vitest";
import { moment } from "obsidian";
import { deviceId, DEVICE_KEY, WordLog } from "../src/wordlogstore";
import { addToLog, newLogFile, parseLog } from "../src/wordlog";
import { fakePlugin, FakeApp } from "./helpers/fake-app";

const LOG = "99 - System/Inkwell/Word log";
const TODAY = moment().format("YYYY-MM-DD");
const MONTH = TODAY.slice(0, 7);
const DRAFT = "02 - Stories/The Chapel/The Chapel - Draft.md";

/** A device's month note holding some rows. */
const logOf = (device: string, rows: { path: string; words: number; date?: string }[]) =>
  addToLog(newLogFile(device, MONTH), rows.map((r) => ({ date: r.date ?? TODAY, path: r.path, words: r.words })));

function setup(files: Record<string, string> = {}) {
  const app = new FakeApp().seed(files);
  app.saveLocalStorage(DEVICE_KEY, "desktop-0001");
  const scheduled: (() => void)[] = [];
  const words = new WordLog(fakePlugin(app), { schedule: (fn) => void scheduled.push(fn) });
  return { app, words, scheduled };
}

describe("the device id", () => {
  it("is made once and kept in local storage", () => {
    const app = new FakeApp();
    const id = deviceId(app);
    expect(id).toMatch(/^desktop-[0-9a-f]{4}$/);
    expect(deviceId(app)).toBe(id);
    expect(app.loadLocalStorage(DEVICE_KEY)).toBe(id);
  });
});

describe("storing the log", () => {
  it("a flush writes only this device's file", async () => {
    const phone = `${LOG}/mobile-0002/${MONTH}.md`;
    const phoneText = logOf("mobile-0002", [{ path: DRAFT, words: 150 }]);
    const { app, words } = setup({ [phone]: phoneText });
    words.add(DRAFT, 200);
    await words.store.flush();
    expect(app.textOf(phone)).toBe(phoneText);
    const own = app.textOf(`${LOG}/desktop-0001/${MONTH}.md`) ?? "";
    expect(own).toContain("device: desktop-0001");
    expect(parseLog(own)).toEqual([{ date: TODAY, path: DRAFT, words: 200 }]);
  });

  it("two devices' files add up", async () => {
    const { words } = setup({ [`${LOG}/mobile-0002/${MONTH}.md`]: logOf("mobile-0002", [{ path: DRAFT, words: 150 }]) });
    words.add(DRAFT, 200);
    await words.store.flush();
    expect(await words.words(() => true, TODAY)).toBe(350);
  });

  it("a second flush adds to the same row", async () => {
    const { app, words } = setup();
    words.add(DRAFT, 20);
    words.add(DRAFT, 5);
    await words.store.flush();
    words.add(DRAFT, -10);
    await words.store.flush();
    expect(parseLog(app.textOf(`${LOG}/desktop-0001/${MONTH}.md`) ?? "")).toEqual([{ date: TODAY, path: DRAFT, words: 15 }]);
  });

  it("counts words not yet written, and flushes them after a wait", async () => {
    const { app, words, scheduled } = setup();
    words.add(DRAFT, 12);
    words.add(DRAFT, 3);
    expect(await words.wordsThisWeek((p) => p === DRAFT)).toBe(15);
    expect(scheduled).toHaveLength(1);
    scheduled[0]?.();
    await words.store.flush();
    expect(parseLog(app.textOf(`${LOG}/desktop-0001/${MONTH}.md`) ?? "")[0]?.words).toBe(15);
  });

  it("reads a log note again once it changes", async () => {
    const path = `${LOG}/mobile-0002/${MONTH}.md`;
    const { app, words } = setup({ [path]: logOf("mobile-0002", [{ path: DRAFT, words: 10 }]) });
    expect(await words.words(() => true, TODAY)).toBe(10);
    await app.vault.modify(app.file(path), logOf("mobile-0002", [{ path: DRAFT, words: 40 }]));
    expect(await words.words(() => true, TODAY)).toBe(40);
  });
});

describe("renames", () => {
  it("renaming a story keeps its words this week", async () => {
    const phone = `${LOG}/mobile-0002/${MONTH}.md`;
    const phoneText = logOf("mobile-0002", [{ path: DRAFT, words: 100 }]);
    const { app, words } = setup({ [phone]: phoneText });
    words.add(DRAFT, 500);
    await words.store.flush();
    words.add(DRAFT, 7);
    await words.store.rename("02 - Stories/The Chapel", "02 - Stories/The Lock");
    const moved = "02 - Stories/The Lock/The Chapel - Draft.md";
    expect(await words.wordsThisWeek((p) => p === moved)).toBe(507);
    // Another device's notes are never written, so its row keeps the old path.
    expect(app.textOf(phone)).toBe(phoneText);
    await words.store.rename(moved, "02 - Stories/The Lock/The Lock - Draft.md");
    await words.store.flush();
    expect(parseLog(app.textOf(`${LOG}/desktop-0001/${MONTH}.md`) ?? "")).toEqual([
      { date: TODAY, path: "02 - Stories/The Lock/The Lock - Draft.md", words: 507 },
    ]);
  });
});
