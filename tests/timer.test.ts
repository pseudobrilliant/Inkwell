import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Notice } from "./helpers/obsidian";
import { TIMER_STORAGE_KEY, WritingTimer } from "../src/timer";
import { openTodaysJournal } from "../src/journal";
import * as T from "../src/timerstate";
import { findBlocks } from "../src/writingblocks";
import { switchInFile, type WritingBlockHost } from "../src/writingblocktoolbar";
import { FakeApp, fakePlugin } from "./helpers/fake-app";

const MIN = 60_000;
const t0 = 10_000_000;
const EX = "01 - Practice/Exercises/Writing/Rain.md";
const OTHER = "01 - Practice/Exercises/Writing/Sun.md";

const draftBlock = (words: string) => `> [!writing|revision timer]\n> ${words}`;
const freewriteBlock = (words: string) => `> [!writing|timer]\n> ${words}`;
const CHAR = "02 - Stories/Tide/Mara.md";
const reviewedBlock = (words: string, mode = "review") => `${draftBlock(words)}\n\n%% writing-block first-draft ${mode}\n${words}\n%%`;
const exercise = (body: string, writingMin = 5) => `---\ntype: exercise\nminutes: 10\nwriting_min: ${writingMin}\n---\n## Work\n\n${body}\n`;

/** A timer for `path` that has run `ms`, stored on the device as a reload would find it. */
function stored(app: FakeApp, path: string, ms: number) {
  const s = T.pause(T.typed(T.armed(path, 10), t0), "user", t0 + ms);
  app.saveLocalStorage(TIMER_STORAGE_KEY, s);
}

function timerState(app: FakeApp): T.TimerState | null {
  const v: unknown = app.loadLocalStorage(TIMER_STORAGE_KEY);
  return T.isTimerState(v) ? v : null;
}

describe("the writing timer and a block's first review", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { setInterval: () => 0 });
    vi.spyOn(Date, "now").mockReturnValue(t0 + 20 * MIN);
    Notice.messages = [];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("first review stops the timer and logs its minutes", async () => {
    const app = new FakeApp().seed({ [EX]: exercise(draftBlock("Rain on the roof.")) });
    stored(app, EX, 12 * MIN + 10_000);
    const timer = new WritingTimer(fakePlugin(app));
    await timer.blockReviewed(EX, exercise(reviewedBlock("Rain on the roof.")));
    expect(app.fmOfPath(EX)?.writing_min).toBe(17);
    expect(Notice.messages).toContain("Logged 12 minutes to Rain.");
    expect(timerState(app)).toBeNull();
  });

  it("first review re-arms when another block is still in draft", async () => {
    const app = new FakeApp().seed({ [EX]: exercise(`${draftBlock("One.")}\n\n${draftBlock("Two.")}`) });
    stored(app, EX, 4 * MIN);
    const timer = new WritingTimer(fakePlugin(app));
    await timer.blockReviewed(EX, exercise(`${reviewedBlock("One.")}\n\n${draftBlock("Two.")}`));
    expect(app.fmOfPath(EX)?.writing_min).toBe(9);
    const s = timerState(app);
    expect(s).toMatchObject({ path: EX, phase: "armed", goalMin: 10, elapsedMs: 0 });
  });

  it("first review re-arms with no goal when only free-write is left", async () => {
    const app = new FakeApp().seed({ [EX]: exercise(`${draftBlock("One.")}\n\n## Reflection\n${freewriteBlock("Slow.")}`) });
    stored(app, EX, 4 * MIN);
    const timer = new WritingTimer(fakePlugin(app));
    await timer.blockReviewed(EX, exercise(`${reviewedBlock("One.")}\n\n## Reflection\n${freewriteBlock("Slow.")}`));
    expect(app.fmOfPath(EX)?.writing_min).toBe(9);
    expect(timerState(app)).toMatchObject({ path: EX, phase: "armed", goalMin: 0, elapsedMs: 0 });
  });

  it("stopping in a note without writing_min leaves its frontmatter alone", async () => {
    const text = `---\ntype: character\n---\n${freewriteBlock("She kept the boat.")}\n`;
    const app = new FakeApp().seed({ [CHAR]: text });
    stored(app, CHAR, 6 * MIN);
    const timer = new WritingTimer(fakePlugin(app));
    await timer.stop();
    expect(app.textOf(CHAR)).toBe(text);
    expect(Notice.messages).toContain("You wrote 6 minutes in Mara.");
    expect(timerState(app)).toBeNull();
  });

  it("stopping in a note with an empty writing_min fills it in", async () => {
    const app = new FakeApp().seed({ [CHAR]: `---\ntype: character\nwriting_min:\n---\n${freewriteBlock("She kept the boat.")}\n` });
    stored(app, CHAR, 4 * MIN);
    const timer = new WritingTimer(fakePlugin(app));
    await timer.stop();
    expect(app.fmOfPath(CHAR)?.writing_min).toBe(4);
  });

  it("opening today's journal arms a timer with no goal", async () => {
    const plugin = fakePlugin();
    plugin.timer = new WritingTimer(plugin);
    await openTodaysJournal(plugin);
    expect(timerState(plugin.app)).toMatchObject({ phase: "armed", goalMin: 0 });
    expect(timerState(plugin.app)?.path).toMatch(/^01 - Practice\/Journal\//);
  });

  it("switching a reviewed block's mode leaves the timer alone", async () => {
    const app = new FakeApp().seed({ [EX]: exercise(`${reviewedBlock("One.")}\n\n${draftBlock("Two.")}`) });
    app.saveLocalStorage(TIMER_STORAGE_KEY, T.armed(EX, 10));
    const timer = new WritingTimer(fakePlugin(app));
    const reviewed: string[] = [];
    const host: WritingBlockHost = {
      tools: [timer.tool],
      onWritingInBlock: () => undefined,
      onBlockWords: () => undefined,
      onFirstDraftSaved: ({ sourcePath, text }) => {
        reviewed.push(sourcePath);
        void timer.blockReviewed(sourcePath, text);
      },
    };
    for (const mode of ["edited", "writing", "review"] as const) {
      const [first] = findBlocks(app.textOf(EX) ?? "");
      expect(await switchInFile(app as never, app.file(EX), first!.start, first!.text, mode, host)).toBe(true);
    }
    expect(reviewed).toEqual([]);
    expect(timerState(app)).toEqual(T.armed(EX, 10));
    expect(app.fmOfPath(EX)?.writing_min).toBe(5);
  });

  it("reviewing in another note leaves the timer alone", async () => {
    const app = new FakeApp().seed({ [EX]: exercise(draftBlock("Rain.")), [OTHER]: exercise(draftBlock("Sun.")) });
    stored(app, EX, 3 * MIN);
    const before = timerState(app);
    const timer = new WritingTimer(fakePlugin(app));
    await timer.blockReviewed(OTHER, exercise(reviewedBlock("Sun.")));
    expect(timerState(app)).toEqual(before);
    expect(app.fmOfPath(EX)?.writing_min).toBe(5);
    expect(app.fmOfPath(OTHER)?.writing_min).toBe(5);
  });
});
