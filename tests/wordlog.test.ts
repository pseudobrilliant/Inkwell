import { describe, expect, it } from "vitest";
import { moment } from "obsidian";
import {
  addToLog,
  dailyWordsIn,
  heatLevel,
  heatmapGrid,
  newLogFile,
  parseLog,
  parseStops,
  renameInLog,
  streakIn,
  weekStartFor,
  wordsSummary,
  type LogRow,
} from "../src/wordlog";

const DRAFT = "02 - Stories/The Chapel/The Chapel - Draft.md";
const days = (entries: Record<string, number>) => new Map(Object.entries(entries));

describe("the log file", () => {
  it("a log file is a plain note with a row per day and note", () => {
    const text = addToLog(newLogFile("desktop-3f9a", "2026-11"), [{ date: "2026-11-26", path: DRAFT, words: 25 }]);
    expect(text).toBe(
      [
        "---",
        "type: word-log",
        "device: desktop-3f9a",
        "month: 2026-11",
        "---",
        "| Date | Note | Words |",
        "| --- | --- | --- |",
        `| 2026-11-26 | ${DRAFT} | 25 |`,
        "",
      ].join("\n")
    );
    expect(parseLog(text)).toEqual([{ date: "2026-11-26", path: DRAFT, words: 25 }]);
  });

  it("adds to a day's row, and appends a row for a new day or note", () => {
    let text = addToLog(newLogFile("d", "2026-11"), [{ date: "2026-11-25", path: DRAFT, words: 10 }]);
    text = addToLog(text, [
      { date: "2026-11-25", path: DRAFT, words: -4 },
      { date: "2026-11-26", path: DRAFT, words: 7 },
      { date: "2026-11-26", path: "a.md", words: 3 },
      { date: "2026-11-26", path: "a.md", words: 2 },
    ]);
    expect(parseLog(text)).toEqual([
      { date: "2026-11-25", path: DRAFT, words: 6 },
      { date: "2026-11-26", path: DRAFT, words: 7 },
      { date: "2026-11-26", path: "a.md", words: 5 },
    ]);
  });

  it("keeps a | in a note's path", () => {
    const text = addToLog(newLogFile("d", "2026-11"), [{ date: "2026-11-26", path: "A|B.md", words: 1 }]);
    expect(text).toContain("| A\\|B.md |");
    expect(parseLog(text)[0]?.path).toBe("A|B.md");
  });

  it("starts a table in a file that has none", () => {
    const text = addToLog("---\ntype: word-log\n---\nNotes by hand.\n", [{ date: "2026-11-26", path: "a.md", words: 2 }]);
    expect(text).toBe("---\ntype: word-log\n---\nNotes by hand.\n| Date | Note | Words |\n| --- | --- | --- |\n| 2026-11-26 | a.md | 2 |\n");
  });

  it("a damaged row is skipped, and kept after a write", () => {
    const text = newLogFile("d", "2026-11") + "| 2026-11-24 | a.md | lots |\n| 2026-11-25 | a.md | 12 |\n";
    expect(parseLog(text)).toEqual([{ date: "2026-11-25", path: "a.md", words: 12 }]);
    const after = addToLog(text, [{ date: "2026-11-26", path: "a.md", words: 1 }]);
    expect(after).toContain("| 2026-11-24 | a.md | lots |");
    expect(parseLog(after)).toHaveLength(2);
  });
});

describe("renames in the log", () => {
  const text = addToLog(newLogFile("d", "2026-11"), [
    { date: "2026-11-26", path: DRAFT, words: 500 },
    { date: "2026-11-26", path: "02 - Stories/The Chapel/Notes/n.md", words: 3 },
    { date: "2026-11-26", path: "02 - Stories/The Chapelry/x.md", words: 1 },
  ]);

  it("renames a note", () => {
    const paths = parseLog(renameInLog(text, DRAFT, "02 - Stories/The Chapel/The Lock - Draft.md")).map((r) => r.path);
    expect(paths[0]).toBe("02 - Stories/The Chapel/The Lock - Draft.md");
  });

  it("renames a folder and everything in it, but not a folder that only shares its name", () => {
    const paths = parseLog(renameInLog(text, "02 - Stories/The Chapel", "02 - Stories/The Lock")).map((r) => r.path);
    expect(paths).toEqual(["02 - Stories/The Lock/The Chapel - Draft.md", "02 - Stories/The Lock/Notes/n.md", "02 - Stories/The Chapelry/x.md"]);
  });

  it("returns the same text when nothing matched", () => {
    expect(renameInLog(text, "elsewhere.md", "x.md")).toBe(text);
  });
});

describe("adding up", () => {
  const rows: LogRow[] = [
    { date: "2026-11-20", path: "a.md", words: 5 },
    { date: "2026-11-25", path: "a.md", words: 10 },
    { date: "2026-11-25", path: "b.md", words: 20 },
    { date: "2026-11-26", path: "a.md", words: -3 },
  ];

  it("sums matching notes per day within the dates", () => {
    expect(dailyWordsIn(rows, () => true, "2026-11-21", "2026-11-26")).toEqual(days({ "2026-11-25": 30, "2026-11-26": -3 }));
    expect(dailyWordsIn(rows, (p) => p === "a.md", "2026-11-01", "2026-11-30")).toEqual(
      days({ "2026-11-20": 5, "2026-11-25": 10, "2026-11-26": -3 })
    );
  });
});

describe("the streak", () => {
  it("counts up to yesterday while today has no words yet", () => {
    const d = days({ "2026-11-21": 10, "2026-11-22": 5, "2026-11-23": 1, "2026-11-24": 80, "2026-11-25": 300 });
    expect(streakIn(d, "2026-11-26")).toEqual({ current: 5, longest: 5 });
    d.set("2026-11-26", 12);
    expect(streakIn(d, "2026-11-26")).toEqual({ current: 6, longest: 6 });
  });

  it("a day of cutting doesn't count as showed up", () => {
    const d = days({ "2026-11-23": 10, "2026-11-24": -40, "2026-11-25": 20 });
    expect(streakIn(d, "2026-11-25")).toEqual({ current: 1, longest: 1 });
  });

  it("keeps the longest streak after a break", () => {
    const d = days({ "2026-10-01": 1, "2026-10-02": 1, "2026-10-03": 1, "2026-11-25": 1 });
    expect(streakIn(d, "2026-11-26")).toEqual({ current: 1, longest: 3 });
    expect(streakIn(new Map(), "2026-11-26")).toEqual({ current: 0, longest: 0 });
  });
});

describe("the week start", () => {
  it("starts the week on the writer's day", () => {
    const wed = moment("2026-11-25");
    expect(weekStartFor(wed, "sunday")).toBe("2026-11-22");
    expect(weekStartFor(wed, "monday")).toBe("2026-11-23");
    expect(weekStartFor(wed, "wednesday")).toBe("2026-11-25");
    expect(weekStartFor(wed, "thursday")).toBe("2026-11-19");
  });
});

describe("the heatmap", () => {
  it("shades days by stops", () => {
    expect([0, -5, 1, 99, 100, 499, 500, 999, 1000, 5000].map((w) => heatLevel(w))).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(heatLevel(50, [10, 20])).toBe(2);
    expect(parseStops("1000, 100 500")).toEqual([100, 500, 1000]);
    expect(parseStops("none")).toEqual([1, 100, 500, 1000]);
  });

  it("lays out weeks of days ending with this week, with empty days and future days", () => {
    const grid = heatmapGrid(days({ "2026-11-24": 300, "2026-11-10": 1200 }), moment("2026-11-25"), 3, "monday");
    expect(grid).toHaveLength(3);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid[0]?.[0]?.date).toBe("2026-11-09");
    expect(grid[2]?.[6]?.date).toBe("2026-11-29");
    expect(grid[0]?.[1]).toEqual({ date: "2026-11-10", words: 1200, level: 4, future: false });
    expect(grid[2]?.[1]).toEqual({ date: "2026-11-24", words: 300, level: 2, future: false });
    expect(grid[1]?.[0]).toEqual({ date: "2026-11-16", words: 0, level: 0, future: false });
    expect(grid[2]?.[3]?.future).toBe(true);
  });
});

describe("the words block", () => {
  it("shows today, this week, this month with its daily average, and the streak", () => {
    const d = new Map<string, number>();
    // 1–9 November: 3,300 words; then 10–15: 200 a day except 300 today (the 15th, a Sunday).
    d.set("2026-11-01", 3300);
    for (let day = 10; day <= 14; day++) d.set(`2026-11-${day}`, 180);
    d.set("2026-11-15", 300);
    const s = wordsSummary(d, moment("2026-11-15"), "monday");
    expect(s).toEqual({ today: 300, week: 1200, month: 4500, monthAverage: 300, streak: { current: 6, longest: 6 } });
  });
});
