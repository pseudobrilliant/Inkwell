import { describe, expect, it } from "vitest";
import { moment } from "obsidian";
import { entriesDay, entriesView, heatmapMatch, wordStats } from "../src/wordblocks";
import { dailyWordsIn, goalProgress, heatmapGrid, wordsSummary, type Goals, type LogRow } from "../src/wordlog";
import { fakePlugin } from "./helpers/fake-app";

const rows: LogRow[] = [
  { date: "2026-11-24", path: "01 - Practice/Journal/2026-11-24.md", words: 300 },
  { date: "2026-11-24", path: "02 - Stories/Tide/Tide - Draft.md", words: 200 },
  { date: "2026-11-24", path: "03 - Projects/Low/Scenes/00-10 A.md", words: 100 },
  { date: "2026-11-24", path: "05 - Resources/A poem.md", words: 50 },
];
const wordsFor = (of: Parameters<typeof heatmapMatch>[1]) => dailyWordsIn(rows, heatmapMatch(fakePlugin(), of), "2026-01-01", "2026-12-31").get("2026-11-24");

describe("the heatmap block", () => {
  it("counts pieces by default, or what `of` picks", () => {
    expect(wordsFor("pieces")).toBe(300);
    expect(wordsFor("practice")).toBe(300);
    expect(wordsFor("stories")).toBe(200);
    expect(wordsFor("projects")).toBe(100);
    expect(wordsFor("all")).toBe(600);
  });

  it("Home's heatmap shows 48 weeks of all the writer's words", () => {
    const days = dailyWordsIn(rows, heatmapMatch(fakePlugin(), "all"), "2025-01-01", "2026-11-25");
    const grid = heatmapGrid(days, moment("2026-11-25"), 48, "monday");
    expect(grid).toHaveLength(48);
    expect(grid.flat().find((d) => d.date === "2026-11-24")).toMatchObject({ words: 600, level: 3 });
  });
});

describe("goals in the words block", () => {
  // Thursday 26 November 2026, in a week starting Monday the 23rd.
  const today = moment("2026-11-26");
  const statsFor = (entries: Record<string, number>, goals: Goals) => {
    const days = new Map(Object.entries(entries));
    return wordStats(wordsSummary(days, today, "monday"), goalProgress(days, today, "monday", goals));
  };

  it("the words block shows today and this week against the goals", () => {
    const [t, w] = statsFor({ "2026-11-23": 400, "2026-11-24": 380, "2026-11-26": 120 }, { daily: 300, weekly: 1500 });
    expect(t).toMatchObject({ label: "Today", value: "120", caption: "of 300", goal: { text: "120 of 300", share: 0.4, met: false } });
    expect(w).toMatchObject({ label: "This week", value: "900", caption: "of 1,500 · 2 goal days", goal: { text: "900 of 1,500", share: 0.6, met: false } });
  });

  it("a met goal shows a full bar marked met", () => {
    const [t] = statsFor({ "2026-11-26": 450 }, { daily: 300, weekly: 1500 });
    expect(t?.goal).toEqual({ text: "450 of 300", share: 1, met: true, label: "Daily word goal met" });
    expect(t?.caption).toBe("of 300 ✓");
  });

  it("only a weekly goal shows only the week's bar", () => {
    const [t, w] = statsFor({ "2026-11-26": 450 }, { daily: 0, weekly: 2000 });
    expect(t?.goal).toBeUndefined();
    expect(w?.goal?.text).toBe("450 of 2,000");
    expect(w?.caption).toBe("of 2,000");
    expect(t?.caption).toBeUndefined();
  });

  it("with both goals off, the block shows only the words", () => {
    const stats = statsFor({ "2026-11-26": 450 }, { daily: 0, weekly: 0 });
    expect(stats.map((x) => x.goal)).toEqual([undefined, undefined, undefined, undefined]);
    expect(stats.map((x) => x.caption)).toEqual([undefined, undefined, "17 a day", "Best 1"]);
  });
});

describe("the entries block", () => {
  const today = moment("2026-11-27");
  const TIDE = "02 - Stories/Tide/Tide - Draft.md";
  const JOURNAL = "01 - Practice/Journal/2026-11-22.md";

  it("the entries block shows the date option, else a journal's day, else today", () => {
    const journal = { fm: { type: "journal" }, basename: "2026-11-21" };
    const draft = { fm: { type: "draft" }, basename: "Tide - Draft" };
    expect(entriesDay(undefined, journal, today, "YYYY-MM-DD")).toBe("2026-11-21");
    expect(entriesDay(undefined, { fm: { type: "journal", created: "2026-11-19" }, basename: "2026-11-21" }, today, "YYYY-MM-DD")).toBe("2026-11-19");
    expect(entriesDay(undefined, draft, today, "YYYY-MM-DD")).toBe("2026-11-27");
    expect(entriesDay("2026-11-20", draft, today, "YYYY-MM-DD")).toBe("2026-11-20");
    expect(entriesDay("2026-11-20", journal, today, "YYYY-MM-DD")).toBe("2026-11-20");
    // A journal named in another date format, a typo in the option, and a block outside any note.
    expect(entriesDay(undefined, { fm: { type: "journal" }, basename: "21.11.2026" }, today, "DD.MM.YYYY")).toBe("2026-11-21");
    expect(entriesDay("Nov 20", journal, today, "YYYY-MM-DD")).toBe("2026-11-21");
    expect(entriesDay(undefined, { fm: { type: "journal" }, basename: "Monday" }, today, "YYYY-MM-DD")).toBe("2026-11-27");
    expect(entriesDay(undefined, null, today, "YYYY-MM-DD")).toBe("2026-11-27");
  });

  it("an entry for a deleted note shows its name without a link", () => {
    const view = entriesView({ entries: [{ path: TIDE, words: 450 }, { path: JOURNAL, words: 1 }], total: 451 }, (p) => p === JOURNAL, 0);
    expect(view.entries).toEqual([
      { path: TIDE, name: "Tide - Draft", words: "450 words", link: false },
      { path: JOURNAL, name: "2026-11-22", words: "1 word", link: true },
    ]);
  });

  it("the entries block shows the day's total against the daily goal, or alone when it's off", () => {
    const day = { entries: [{ path: TIDE, words: 450 }, { path: JOURNAL, words: 120 }], total: 570 };
    const met = entriesView(day, () => true, 300);
    expect(met.total).toBe("570 words");
    expect(met.goal).toMatchObject({ text: "570 of 300", share: 1, met: true });
    expect(entriesView({ ...day, total: 150 }, () => true, 300).goal).toMatchObject({ text: "150 of 300", share: 0.5, met: false });
    expect(entriesView(day, () => true, 0).goal).toBeUndefined();
  });

  it("a day with nothing written says so plainly", () => {
    const view = entriesView({ entries: [], total: 0 }, () => true, 300);
    expect(view.empty).toBe(true);
    expect(view.entries).toEqual([]);
  });
});
