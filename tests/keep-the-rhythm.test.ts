import { describe, expect, it } from "vitest";
import { moment } from "obsidian";
import { dailyWordsIn, streakIn, usableData, weekStartFor, type KtrData } from "../src/integrations/keep-the-rhythm";

/** The shape of KTR 0.2.16's data.json (trimmed). */
const data: KtrData = {
  schema: "0.2",
  settings: { startOfTheWeek: "SUNDAY" },
  stats: {
    currentStreak: 4,
    highestStreak: 12,
    dailyActivity: [
      { date: "2026-11-20", filePath: "02 - Stories/Tide/Tide - Draft.md", changes: [{ w: 120 }, { w: -20 }] },
      { date: "2026-11-21", filePath: "02 - Stories/Tide/Tide - Draft.md", changes: [{ w: 300 }] },
      { date: "2026-11-21", filePath: "01 - Practice/Journal/2026-11-21.md", changes: [{ w: 50 }] },
      { date: "2026-11-25", filePath: "02 - Stories/Tide/Tide - Draft.md", changes: [{ w: 40 }, {}] },
    ],
  },
};

describe("Keep the Rhythm data", () => {
  it("accepts only the tested schema with an activity list", () => {
    expect(usableData(data)).toBe(data);
    expect(usableData({ ...data, schema: "0.3" })).toBeNull();
    expect(usableData({ schema: "0.2", stats: {} })).toBeNull();
    expect(usableData(null)).toBeNull();
    expect(usableData("not json")).toBeNull();
  });

  it("sums net words per day for matching files within the dates", () => {
    const drafts = (p: string) => p.endsWith(" - Draft.md");
    const days = dailyWordsIn(data, drafts, "2026-11-21", "2026-11-25");
    expect([...days]).toEqual([
      ["2026-11-21", 300],
      ["2026-11-25", 40],
    ]);
  });

  it("includes both ends of the date range", () => {
    const all = () => true;
    expect(dailyWordsIn(data, all, "2026-11-20", "2026-11-20").get("2026-11-20")).toBe(100);
  });

  it("skips malformed entries instead of failing", () => {
    const bad = { schema: "0.2", stats: { dailyActivity: [{ date: 5 }, null, { date: "2026-11-25", filePath: "a.md", changes: [{ w: "7" }] }] } };
    expect([...dailyWordsIn(bad as unknown as KtrData, () => true, "2026-01-01", "2026-12-31")]).toEqual([["2026-11-25", 7]]);
  });

  it("reads the streak, defaulting to zero", () => {
    expect(streakIn(data)).toEqual({ current: 4, highest: 12 });
    expect(streakIn({ schema: "0.2", stats: { dailyActivity: [] } })).toEqual({ current: 0, highest: 0 });
  });

  it("finds the start of the week from KTR's setting", () => {
    const wednesday = moment("2026-11-25", "YYYY-MM-DD");
    expect(weekStartFor(wednesday, "SUNDAY")).toBe("2026-11-22");
    expect(weekStartFor(wednesday, "MONDAY")).toBe("2026-11-23");
    expect(weekStartFor(wednesday, undefined)).toBe("2026-11-23");
    expect(weekStartFor(wednesday, "WEDNESDAY")).toBe("2026-11-25");
  });
});
