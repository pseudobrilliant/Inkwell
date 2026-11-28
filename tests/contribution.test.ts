import { describe, expect, it } from "vitest";
import { moment } from "obsidian";
import { contribution, practiceStats, practiceWeek, recentPractice, whenWorked, type PracticeNote } from "../src/contribution";
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

describe("goal days in practice this week", () => {
  const DAY_OF = (i: number) => moment(practiceStart()).add(i, "days").format(DAY);
  const practiceStart = () => fakePlugin().words.weekStart();

  it("the practice strip marks goal days apart from days that showed up", async () => {
    const plugin = vaultWithLog([
      { date: DAY_OF(0), path: EXERCISE, words: 350 },
      { date: DAY_OF(1), path: DRAFT, words: 50 },
    ]);
    plugin.settings.dailyWordGoal = 300;
    const [mon, tue, wed] = (await practiceWeek(plugin)).days;
    expect(mon).toMatchObject({ showed: true, goal: true });
    expect(tue).toMatchObject({ showed: true, goal: false });
    expect(wed).toMatchObject({ showed: false, goal: false });
  });

  it("a day under the goal has no missed mark", async () => {
    const plugin = vaultWithLog([{ date: DAY_OF(0), path: JOURNAL, words: 40 }]);
    plugin.settings.dailyWordGoal = 300;
    const [day] = (await practiceWeek(plugin)).days;
    // Showed up, and nothing else to say about it.
    expect(day && Object.keys(day).sort()).toEqual(["date", "future", "goal", "showed"]);
    expect(day).toMatchObject({ showed: true, goal: false });
  });

  it("with the daily goal off, no day is a goal day", async () => {
    const plugin = vaultWithLog([{ date: DAY_OF(0), path: EXERCISE, words: 5000 }]);
    plugin.settings.dailyWordGoal = 0;
    expect((await practiceWeek(plugin)).days[0]).toMatchObject({ showed: true, goal: false });
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

  it("practice and pieces both count toward the day's goal", async () => {
    const plugin = vaultWithLog([
      { date: TODAY, path: EXERCISE, words: 200 },
      { date: TODAY, path: DRAFT, words: 150 },
      { date: TODAY, path: "05 - Resources/A poem.md", words: 90 },
    ]);
    plugin.settings.dailyWordGoal = 300;
    expect((await plugin.words.goals()).today).toEqual({ words: 350, goal: 300, share: 1, met: true });
  });

  it("a story's words this week count only its draft", async () => {
    const plugin = vaultWithLog([
      { date: TODAY, path: DRAFT, words: 400 },
      { date: TODAY, path: EXERCISE, words: 300 },
    ]);
    expect(await plugin.words.wordsThisWeek((p) => p === DRAFT)).toBe(400);
  });
});

describe("recent practice", () => {
  // Friday 27 November 2026, mid-afternoon.
  const today = moment("2026-11-27 15:00");
  const at = (s: string) => moment(s).valueOf();
  const note = (over: Partial<PracticeNote>): PracticeNote => ({ path: "x.md", basename: "x", type: "exercise", created: "", mtime: 0, minutes: 0, ...over });

  it("says when a note was last worked on, nearest first", () => {
    expect(whenWorked(at("2026-11-27 09:00"), today)).toBe("Today");
    expect(whenWorked(at("2026-11-26 23:00"), today)).toBe("Yesterday");
    expect(whenWorked(at("2026-11-23 10:00"), today)).toBe("Monday");
    expect(whenWorked(at("2026-11-12 10:00"), today)).toBe("12 Nov");
    expect(whenWorked(at("2025-12-30 10:00"), today)).toBe("30 Dec 2025");
  });

  it("lists exercises and journal entries, last worked on first, with journals titled by their day", () => {
    const rows = recentPractice(
      [
        note({ path: "a.md", basename: "Tense Cooking", mtime: at("2026-11-25 10:00"), minutes: 15 }),
        note({ path: "j.md", basename: "2026-11-27", type: "journal", mtime: at("2026-11-27 08:00") }),
        note({ path: "k.md", basename: "2026-11-21", type: "journal", created: "2026-11-21", mtime: at("2026-11-21 08:00") }),
        note({ path: "p.md", basename: "A prompt", type: "prompt", mtime: at("2026-11-27 12:00") }),
      ],
      today,
      7,
      "YYYY-MM-DD"
    );
    expect(rows).toEqual([
      { path: "j.md", kind: "journal", title: "Friday 27 Nov", minutes: "", when: "Today" },
      { path: "a.md", kind: "exercise", title: "Tense Cooking", minutes: "15 min", when: "Wednesday" },
      { path: "k.md", kind: "journal", title: "Saturday 21 Nov", minutes: "", when: "Saturday" },
    ]);
    expect(recentPractice([note({ mtime: 1 }), note({ mtime: 2 })], today, 1, "YYYY-MM-DD")).toHaveLength(1);
  });
});

describe("practice this week", () => {
  it("shows the week's numbers as tiles, every one even at zero", () => {
    const week = { days: [], exercises: 3, prompts: 1, journals: 1, minutes: 0, practiceWords: 1722, streak: { current: 1, longest: 3 } };
    expect(practiceStats(week)).toEqual([
      { label: "Exercises", value: "3" },
      { label: "Prompts used", value: "1" },
      { label: "Journal entry", value: "1" },
      { label: "Minutes written", value: "0" },
      { label: "Practice words", value: "1,722" },
    ]);
  });
});
