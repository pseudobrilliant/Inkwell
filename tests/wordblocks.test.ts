import { describe, expect, it } from "vitest";
import { moment } from "obsidian";
import { heatmapMatch, wordStats } from "../src/wordblocks";
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
    expect(t).toMatchObject({ value: "120", label: "Today", goal: { text: "120 of 300", share: 0.4, met: false } });
    expect(w).toMatchObject({ value: "900", label: "This week", sub: "2 goal days", goal: { text: "900 of 1,500", share: 0.6, met: false } });
  });

  it("a met goal shows a full bar marked met", () => {
    const [t] = statsFor({ "2026-11-26": 450 }, { daily: 300, weekly: 1500 });
    expect(t?.goal).toEqual({ text: "450 of 300", share: 1, met: true, label: "Daily word goal met" });
  });

  it("only a weekly goal shows only the week's bar", () => {
    const [t, w] = statsFor({ "2026-11-26": 450 }, { daily: 0, weekly: 2000 });
    expect(t?.goal).toBeUndefined();
    expect(w?.goal?.text).toBe("450 of 2,000");
    expect(w?.sub).toBeUndefined();
  });

  it("with both goals off, the block shows only the words", () => {
    const stats = statsFor({ "2026-11-26": 450 }, { daily: 0, weekly: 0 });
    expect(stats.map((x) => x.goal)).toEqual([undefined, undefined, undefined, undefined]);
  });
});
