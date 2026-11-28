/**
 * Inkwell's word log, the pure part (spec word-log; ADRs 0007 and 0008).
 *
 * Each device keeps one note per month, `<folders.wordLog>/<device>/<YYYY-MM>.md`:
 *
 *     ---
 *     type: word-log
 *     device: desktop-3f9a
 *     month: 2026-11
 *     ---
 *     | Date | Note | Words |
 *     | --- | --- | --- |
 *     | 2026-11-26 | 02 - Stories/The Chapel/The Chapel - Draft.md | 25 |
 *
 * Words are the net change in a note's block words that day, so they can be negative. Lines that aren't a readable
 * row are skipped when adding up and kept as they are when writing. The vault side is src/wordlogstore.ts.
 */
import { moment } from "obsidian";

const DAY = "YYYY-MM-DD";

export interface LogRow {
  /** YYYY-MM-DD */
  date: string;
  /** The note's vault path. */
  path: string;
  words: number;
}

export const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export function isWeekday(v: unknown): v is Weekday {
  return typeof v === "string" && (WEEKDAYS as readonly string[]).includes(v);
}

// ---------- The file ----------

const ROW = /^\|\s*(\d{4}-\d{2}-\d{2})\s*\|(.*)\|\s*(-?\d+)\s*\|\s*$/;
const TABLE_HEAD = ["| Date | Note | Words |", "| --- | --- | --- |"];

const escapeCell = (s: string) => s.replace(/\|/g, "\\|");
const unescapeCell = (s: string) => s.trim().replace(/\\\|/g, "|");
const rowKey = (date: string, path: string) => `${date}\u0000${path}`;

/** A row as a table line. */
export function rowLine(r: LogRow): string {
  return `| ${r.date} | ${escapeCell(r.path)} | ${r.words} |`;
}

/** A row from a table line, or null if the line isn't one Inkwell can read. */
export function parseRow(line: string): LogRow | null {
  const m = line.replace(/\r$/, "").match(ROW);
  if (!m?.[1] || m[2] === undefined || !m[3]) return null;
  const path = unescapeCell(m[2]);
  if (!path) return null;
  return { date: m[1], path, words: parseInt(m[3], 10) };
}

/** Every readable row in a log file. */
export function parseLog(text: string): LogRow[] {
  const rows: LogRow[] = [];
  for (const line of text.split("\n")) {
    const r = parseRow(line);
    if (r) rows.push(r);
  }
  return rows;
}

/** A new, empty log file for a device and month (YYYY-MM). */
export function newLogFile(device: string, month: string): string {
  return ["---", "type: word-log", `device: ${device}`, `month: ${month}`, "---", ...TABLE_HEAD, ""].join("\n");
}

/**
 * Add words to a log file: each one goes onto the row for its day and note, or a new row at the end of the table.
 * Every other line, including rows Inkwell can't read, is kept as it was.
 */
export function addToLog(text: string, add: readonly LogRow[]): string {
  const lines = text.split("\n");
  const at = new Map<string, number>();
  let lastTableLine = -1;
  lines.forEach((line, i) => {
    if (/^\|/.test(line)) lastTableLine = i;
    const r = parseRow(line);
    if (r && !at.has(rowKey(r.date, r.path))) at.set(rowKey(r.date, r.path), i);
  });
  const appended: LogRow[] = [];
  for (const a of add) {
    if (!a.words) continue;
    const i = at.get(rowKey(a.date, a.path));
    const existing = i === undefined ? null : parseRow(lines[i] ?? "");
    if (i !== undefined && existing) {
      lines[i] = rowLine({ ...existing, words: existing.words + a.words });
      continue;
    }
    const same = appended.find((r) => r.date === a.date && r.path === a.path);
    if (same) same.words += a.words;
    else appended.push({ ...a });
  }
  if (!appended.length) return lines.join("\n");
  const newLines = appended.map(rowLine);
  if (lastTableLine === -1) {
    // No table yet: start one at the end, after a blank line if the note has text.
    while (lines.length && lines[lines.length - 1]?.trim() === "") lines.pop();
    return [...lines, ...TABLE_HEAD, ...newLines, ""].join("\n");
  }
  lines.splice(lastTableLine + 1, 0, ...newLines);
  return lines.join("\n");
}

/**
 * Rename a note, or a folder and everything in it, in a log file. Returns the text unchanged (the same string) when
 * nothing in it matched, so the caller can skip the write.
 */
export function renameInLog(text: string, from: string, to: string): string {
  let changed = false;
  const lines = text.split("\n").map((line) => {
    const r = parseRow(line);
    if (!r) return line;
    let path: string | null = null;
    if (r.path === from) path = to;
    else if (r.path.startsWith(from + "/")) path = to + r.path.slice(from.length);
    if (path === null) return line;
    changed = true;
    return rowLine({ ...r, path });
  });
  return changed ? lines.join("\n") : text;
}

// ---------- Adding up ----------

/** Net words per day (YYYY-MM-DD → words) for matching notes between two dates, inclusive. Days with no rows are absent. */
export function dailyWordsIn(rows: readonly LogRow[], match: (path: string) => boolean, from: string, to: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.date < from || r.date > to || !match(r.path)) continue;
    out.set(r.date, (out.get(r.date) ?? 0) + r.words);
  }
  return out;
}

export function sumDays(days: ReadonlyMap<string, number>): number {
  let n = 0;
  for (const w of days.values()) n += w;
  return n;
}

/** One note's net words on a day, summed across devices. */
export interface DayEntry {
  path: string;
  words: number;
}

/**
 * What was written on one day (spec word-log, "The entries block"): each matching note's words summed across every
 * device's rows, notes that come to zero left out, largest first, then by path. `total` is all the matching rows.
 */
export function dayEntries(rows: readonly LogRow[], day: string, match: (path: string) => boolean): { entries: DayEntry[]; total: number } {
  const byPath = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    if (r.date !== day || !match(r.path)) continue;
    byPath.set(r.path, (byPath.get(r.path) ?? 0) + r.words);
    total += r.words;
  }
  const entries = [...byPath]
    .filter(([, words]) => words !== 0)
    .map(([path, words]) => ({ path, words }))
    .sort((a, b) => b.words - a.words || a.path.localeCompare(b.path));
  return { entries, total };
}

export interface Streak {
  current: number;
  longest: number;
}

/**
 * Days showed up in a row, from all-writing words per day. A day counts when its net words are above zero. The current
 * streak runs up to today, or up to yesterday while today has no words yet.
 */
export function streakIn(days: ReadonlyMap<string, number>, today: string): Streak {
  const showed = (d: string) => (days.get(d) ?? 0) > 0;
  const back = (d: string) => moment(d, DAY).subtract(1, "day").format(DAY);
  let current = 0;
  let d = showed(today) ? today : back(today);
  while (showed(d)) {
    current++;
    d = back(d);
  }
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const date of [...days.keys()].filter(showed).sort()) {
    run = prev !== null && back(date) === prev ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = date;
  }
  return { current, longest: Math.max(longest, current) };
}

/** The first day (YYYY-MM-DD) of the week that holds `today`, for a week starting on `weekStart`. */
export function weekStartFor(today: moment.Moment, weekStart: Weekday): string {
  const back = (today.day() - WEEKDAYS.indexOf(weekStart) + 7) % 7;
  return today.clone().subtract(back, "days").format(DAY);
}

// ---------- Heatmap ----------

export const DEFAULT_STOPS: readonly number[] = [1, 100, 500, 1000];

/** Stops from a block option ("100, 500, 1000"): positive whole numbers in order, or the defaults. */
export function parseStops(src: string | undefined): number[] {
  const stops = (src ?? "")
    .split(/[,\s]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  return stops.length ? stops.slice(0, 4) : [...DEFAULT_STOPS];
}

/** A day's shade, 0 (nothing) to 4: how many stops its words reach. Days at or below zero are empty. */
export function heatLevel(words: number, stops: readonly number[] = DEFAULT_STOPS): number {
  if (words <= 0) return 0;
  const reached = stops.filter((s) => words >= s).length;
  return Math.max(1, Math.min(4, reached));
}

export interface HeatDay {
  date: string;
  words: number;
  level: number;
  future: boolean;
}

/**
 * The heatmap's days: `weeks` columns of 7 days each, oldest first, the last column being the week that holds today.
 * Days after today are marked `future`.
 */
export function heatmapGrid(
  days: ReadonlyMap<string, number>,
  today: moment.Moment,
  weeks: number,
  weekStart: Weekday,
  stops: readonly number[] = DEFAULT_STOPS
): HeatDay[][] {
  const todayStr = today.format(DAY);
  const first = moment(weekStartFor(today, weekStart), DAY).subtract(weeks - 1, "weeks");
  const grid: HeatDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = first.clone().add(w * 7 + d, "days").format(DAY);
      const words = days.get(date) ?? 0;
      col.push({ date, words, level: heatLevel(words, stops), future: date > todayStr });
    }
    grid.push(col);
  }
  return grid;
}

/** The first day the heatmap shows. */
export function heatmapStart(today: moment.Moment, weeks: number, weekStart: Weekday): string {
  return moment(weekStartFor(today, weekStart), DAY).subtract(weeks - 1, "weeks").format(DAY);
}

/**
 * The month over each heatmap column: a column whose week holds the 1st of a month gets that month's short name,
 * the rest get "". The first column names its own month, unless the next name is too close to fit beside it.
 */
export function heatmapMonths(grid: readonly HeatDay[][]): string[] {
  const labels = grid.map((week) => {
    const first = week.find((d) => d.date.endsWith("-01"));
    return first ? moment(first.date, DAY).format("MMM") : "";
  });
  const next = labels.findIndex((l, i) => i > 0 && l !== "");
  const start = grid[0]?.[0];
  if (start && labels[0] === "" && (next === -1 || next >= 3)) labels[0] = moment(start.date, DAY).format("MMM");
  return labels;
}

/** The heatmap's row names, first day of the week first: every other day is named, the rest are "". */
export function heatmapDayNames(weekStart: Weekday): string[] {
  const start = WEEKDAYS.indexOf(weekStart);
  return Array.from({ length: 7 }, (_, i) => (i % 2 === 0 ? moment().day((start + i) % 7).format("ddd") : ""));
}

/** What the legend says each shade means, from the stops: shade 0 is no words, then one entry per stop. */
export function heatLegend(stops: readonly number[] = DEFAULT_STOPS): string[] {
  const k = Math.min(4, stops.length);
  const fmt = (x: number) => x.toLocaleString();
  const shades = Array.from({ length: k }, (_, i) => {
    const lo = i === 0 ? 1 : (stops[i] ?? 1);
    const next = stops[i + 1];
    if (i === k - 1 || next === undefined) return `${fmt(lo)}+ words`;
    const hi = next - 1;
    return lo >= hi ? `${fmt(lo)} words` : `${fmt(lo)}–${fmt(hi)} words`;
  });
  return ["No words", ...shades];
}

/** The words and the days written across the heatmap. */
export function heatmapTotals(grid: readonly HeatDay[][]): { words: number; days: number } {
  let words = 0;
  let days = 0;
  for (const d of grid.flat()) {
    words += d.words;
    if (d.words > 0) days++;
  }
  return { words, days };
}

// ---------- The words block ----------

export interface WordsSummary {
  today: number;
  week: number;
  month: number;
  /** The month's words over the days so far, rounded. */
  monthAverage: number;
  streak: Streak;
}

/** What `inkwell-words` shows, from all-writing words per day. */
export function wordsSummary(days: ReadonlyMap<string, number>, today: moment.Moment, weekStart: Weekday): WordsSummary {
  const t = today.format(DAY);
  const between = (from: string) => {
    let n = 0;
    for (const [d, w] of days) if (d >= from && d <= t) n += w;
    return n;
  };
  const month = between(today.clone().startOf("month").format(DAY));
  return {
    today: days.get(t) ?? 0,
    week: between(weekStartFor(today, weekStart)),
    month,
    monthAverage: Math.round(month / today.date()),
    streak: streakIn(days, t),
  };
}

// ---------- Goals (spec word-goals) ----------

/** The daily and weekly word goals. 0 = off. */
export interface Goals {
  daily: number;
  weekly: number;
}

/** Words against a goal, for a progress bar. */
export interface GoalBar {
  words: number;
  goal: number;
  /** How much of the goal is reached, from 0 to 1 (a bar never fills past full). */
  share: number;
  met: boolean;
}

export interface GoalProgress {
  /** Today against the daily goal, or null when it's off. */
  today: GoalBar | null;
  /** This week against the weekly goal, or null when it's off. */
  week: GoalBar | null;
  /** Goal days so far this week, or null when the daily goal is off. */
  goalDays: number | null;
}

/** Words against a goal, or null when the goal is off. */
export function goalBar(words: number, goal: number): GoalBar | null {
  if (goal <= 0) return null;
  return { words, goal, share: Math.max(0, Math.min(1, words / goal)), met: words >= goal };
}

/** A goal day is a day whose words reach the daily goal. With the goal off, no day is one. */
export function isGoalDay(words: number, dailyGoal: number): boolean {
  return dailyGoal > 0 && words >= dailyGoal;
}

/**
 * Today and this week against the goals, from all-writing words per day. The weekly goal counts the week's words
 * however they're spread, so it doesn't depend on the goal days.
 */
export function goalProgress(days: ReadonlyMap<string, number>, today: moment.Moment, weekStart: Weekday, goals: Goals): GoalProgress {
  const t = today.format(DAY);
  const from = weekStartFor(today, weekStart);
  let week = 0;
  let goalDays = 0;
  for (const [d, w] of days) {
    if (d < from || d > t) continue;
    week += w;
    if (isGoalDay(w, goals.daily)) goalDays++;
  }
  return {
    today: goalBar(days.get(t) ?? 0, goals.daily),
    week: goalBar(week, goals.weekly),
    goalDays: goals.daily > 0 ? goalDays : null,
  };
}

/** Whether words going from `before` to `after` reach a goal that's on. */
export function goalReached(before: number, after: number, goal: number): boolean {
  return goal > 0 && before < goal && after >= goal;
}

/** The day, and the week by its first day, that this device last showed each goal notice (local storage). */
export interface GoalNoticesShown {
  day?: string;
  week?: string;
}

export interface GoalTotals {
  today: number;
  week: number;
}

/**
 * Which goal notices to show after the writer's words moved today's and this week's totals from `before` to
 * `after`, at most once a day and once a week. `shown` is what to remember afterwards.
 */
export function goalNoticesDue(
  before: GoalTotals,
  after: GoalTotals,
  goals: Goals,
  last: GoalNoticesShown,
  day: string,
  week: string
): { daily: boolean; weekly: boolean; shown: GoalNoticesShown } {
  const daily = last.day !== day && goalReached(before.today, after.today, goals.daily);
  const weekly = last.week !== week && goalReached(before.week, after.week, goals.weekly);
  return { daily, weekly, shown: { day: daily ? day : last.day, week: weekly ? week : last.week } };
}
