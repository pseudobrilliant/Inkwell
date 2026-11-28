import { describe, expect, it } from "vitest";
import { moment } from "obsidian";
import {
  addToLog,
  dailyWordsIn,
  dayEntries,
  goalNoticesDue,
  goalProgress,
  goalReached,
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
import { modeMatchers } from "../src/contribution";
import { fakePlugin } from "./helpers/fake-app";

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

describe("goals", () => {
  // Thursday 26 November 2026, in a week starting Monday the 23rd.
  const today = moment("2026-11-26");
  const goals = { daily: 300, weekly: 1500 };

  it("missing a day can still make the week", () => {
    const d = days({ "2026-11-22": 900, "2026-11-23": 600, "2026-11-24": 0, "2026-11-25": 500, "2026-11-26": 450 });
    const g = goalProgress(d, today, "monday", goals);
    expect(g.goalDays).toBe(3);
    expect(g.week).toEqual({ words: 1550, goal: 1500, share: 1, met: true });
    expect(g.today).toEqual({ words: 450, goal: 300, share: 1, met: true });
  });

  it("a day under the goal isn't a goal day but keeps the streak", () => {
    const d = days({ "2026-11-23": 100, "2026-11-24": 100, "2026-11-25": 100, "2026-11-26": 100 });
    expect(goalProgress(d, today, "monday", goals).goalDays).toBe(0);
    expect(streakIn(d, "2026-11-26").current).toBe(4);
  });

  it("shows partway to the goals as a share of each", () => {
    const d = days({ "2026-11-23": 400, "2026-11-24": 380, "2026-11-26": 120 });
    const g = goalProgress(d, today, "monday", goals);
    expect(g.today).toEqual({ words: 120, goal: 300, share: 0.4, met: false });
    expect(g.week).toEqual({ words: 900, goal: 1500, share: 0.6, met: false });
    expect(g.goalDays).toBe(2);
  });

  it("a goal of 0 is off", () => {
    const d = days({ "2026-11-26": 500 });
    const g = goalProgress(d, today, "monday", { daily: 0, weekly: 2000 });
    expect(g.today).toBeNull();
    expect(g.goalDays).toBeNull();
    expect(g.week?.goal).toBe(2000);
    expect(goalProgress(d, today, "monday", { daily: 300, weekly: 0 }).week).toBeNull();
  });

  it("a goal is reached only when the words cross it", () => {
    expect(goalReached(280, 310, 300)).toBe(true);
    expect(goalReached(280, 300, 300)).toBe(true);
    expect(goalReached(310, 340, 300)).toBe(false);
    expect(goalReached(200, 250, 300)).toBe(false);
    expect(goalReached(0, 500, 0)).toBe(false);
  });

  it("a goal notice shows once a day and once a week", () => {
    const first = goalNoticesDue({ today: 280, week: 1480 }, { today: 310, week: 1510 }, goals, {}, "2026-11-26", "2026-11-23");
    expect(first).toEqual({ daily: true, weekly: true, shown: { day: "2026-11-26", week: "2026-11-23" } });
    // Cut under both goals and write past them again: no second notice.
    const again = goalNoticesDue({ today: 260, week: 1460 }, { today: 320, week: 1520 }, goals, first.shown, "2026-11-26", "2026-11-23");
    expect(again).toEqual({ daily: false, weekly: false, shown: first.shown });
    // The next day, the daily notice can show again; the week's has been shown.
    const next = goalNoticesDue({ today: 0, week: 1520 }, { today: 300, week: 1820 }, goals, first.shown, "2026-11-27", "2026-11-23");
    expect(next).toMatchObject({ daily: true, weekly: false });
  });
});

describe("a day's entries", () => {
  const JOURNAL = "01 - Practice/Journal/2026-11-22.md";
  const TIDE = "02 - Stories/Tide/Tide - Draft.md";
  const all = modeMatchers(fakePlugin()).all;

  it("a day's entries list each note's words, largest first, with the total", () => {
    const rows: LogRow[] = [
      { date: "2026-11-22", path: JOURNAL, words: 120 },
      { date: "2026-11-22", path: TIDE, words: 450 },
      { date: "2026-11-23", path: TIDE, words: 300 },
    ];
    expect(dayEntries(rows, "2026-11-22", all)).toEqual({
      entries: [
        { path: TIDE, words: 450 },
        { path: JOURNAL, words: 120 },
      ],
      total: 570,
    });
  });

  it("a note written on two devices is listed once with both devices' words", () => {
    // One row from the phone's log note and one from the laptop's.
    const rows: LogRow[] = [
      { date: "2026-11-22", path: TIDE, words: 200 },
      { date: "2026-11-22", path: TIDE, words: 150 },
    ];
    expect(dayEntries(rows, "2026-11-22", all)).toEqual({ entries: [{ path: TIDE, words: 350 }], total: 350 });
  });

  it("a day's entries leave out resources, the log, and notes that add up to zero", () => {
    const rows: LogRow[] = [
      { date: "2026-11-22", path: "05 - Resources/A poem.md", words: 80 },
      { date: "2026-11-22", path: "99 - System/Inkwell/Word log/phone/2026-11.md", words: 10 },
      { date: "2026-11-22", path: TIDE, words: 40 },
      { date: "2026-11-22", path: TIDE, words: -40 },
    ];
    expect(dayEntries(rows, "2026-11-22", all)).toEqual({ entries: [], total: 0 });
    expect(dayEntries([], "2026-11-22", all)).toEqual({ entries: [], total: 0 });
  });
});
