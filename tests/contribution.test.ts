import { describe, expect, it } from "vitest";
import { moment } from "obsidian";
import { contribution, practiceWeek } from "../src/contribution";
import { addToLog, newLogFile, type LogRow } from "../src/wordlog";
import { fakePlugin, FakeApp } from "./helpers/fake-app";

const DAY = "YYYY-MM-DD";
const TODAY = moment().format(DAY);
const LOG = "99 - System/Inkwell/Word log";
const DRAFT = "02 - Stories/The Chapel/The Chapel - Draft.md";
const SCENE = "03 - Projects/Tide/Scenes/00-10 Low Water.md";
const EXERCISE = "01 - Practice/Exercises/Writing/2026-11-25 Low Tide.md";
const JOURNAL = "01 - Practice/Journal/2026-11-25.md";

/** A vault whose word log holds these rows, each in its month's note on one device. */
function vaultWithLog(rows: LogRow[], files: Record<string, string> = {}) {
  const months = new Map<string, LogRow[]>();
  for (const r of rows) months.set(r.date.slice(0, 7), [...(months.get(r.date.slice(0, 7)) ?? []), r]);
  const seed: Record<string, string> = { ...files };
  for (const [month, rs] of months) seed[`${LOG}/mobile-0002/${month}.md`] = addToLog(newLogFile("mobile-0002", month), rs);
  return fakePlugin(new FakeApp().seed(seed));
}

describe("practice this week", () => {
  it("an exercise without writing doesn't count as showing up", async () => {
    const plugin = vaultWithLog([], { [EXERCISE]: `---\ntype: exercise\ncreated: ${TODAY}\n---\n## Work\n> [!writing]\n> \n` });
    const w = await practiceWeek(plugin);
    expect(w.exercises).toBe(1);
    expect(w.days.find((d) => d.date === TODAY)?.showed).toBe(false);
    expect(w.practiceWords).toBe(0);
    expect(w.streak).toEqual({ current: 0, longest: 0 });
  });

  it("a day with words in blocks counts as showing up, and practice words count only practice", async () => {
    const plugin = vaultWithLog([
      { date: TODAY, path: EXERCISE, words: 120 },
      { date: TODAY, path: DRAFT, words: 80 },
    ]);
    const w = await practiceWeek(plugin);
    expect(w.days.find((d) => d.date === TODAY)?.showed).toBe(true);
    expect(w.practiceWords).toBe(120);
    expect(w.streak.current).toBe(1);
  });
});

describe("your contribution", () => {
  it("adds up this month's words by mode", async () => {
    const plugin = vaultWithLog([
      { date: TODAY, path: JOURNAL, words: 400 },
      { date: TODAY, path: EXERCISE, words: 600 },
      { date: TODAY, path: DRAFT, words: 2000 },
      { date: TODAY, path: SCENE, words: 500 },
      { date: TODAY, path: "05 - Resources/A poem.md", words: 30 },
    ]);
    const c = await contribution(plugin, "month");
    expect(c.practice.words).toBe(1000);
    expect(c.stories.words).toBe(2000);
    expect(c.projects.words).toBe(500);
    // All writing: everything but notes on what you read.
    expect(c.words).toBe(3500);
  });

  it("a story's words this week count only its draft", async () => {
    const plugin = vaultWithLog([
      { date: TODAY, path: DRAFT, words: 400 },
      { date: TODAY, path: EXERCISE, words: 300 },
    ]);
    expect(await plugin.words.wordsThisWeek((p) => p === DRAFT)).toBe(400);
  });
});
