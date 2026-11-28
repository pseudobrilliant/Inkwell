/**
 * Word blocks drawn by Inkwell from its word log (spec word-log, "Heatmap" and "The words block"):
 *
 * ```inkwell-heatmap```  One square per day for the last N weeks, shaded by words typed in writing blocks.
 * ```inkwell-words```    Words today, this week and this month, the streak, and the daily and weekly goals.
 * ```inkwell-entries```  What was written on one day, note by note, and the day's total against the daily goal.
 *
 * The heatmap's layout and shades are pure (`heatmapGrid` in src/wordlog.ts); this file only draws them.
 */
import { Keymap, moment, Notice, Platform } from "obsidian";
import type InkwellPlugin from "./main";
import { modeMatchers } from "./contribution";
import { LiveBlock, opts } from "./homeblocks";
import { fmOf, fmStr } from "./util";
import { DEFAULT_STOPS, goalBar, heatLegend, heatmapDayNames, heatmapGrid, heatmapMonths, heatmapStart, heatmapTotals, parseStops, wordsSummary, type DayEntry, type GoalBar, type GoalProgress, type WordsSummary } from "./wordlog";

const n = (x: number) => x.toLocaleString();

export type HeatmapOf = "pieces" | "practice" | "stories" | "projects" | "all";
const HEATMAP_OF: HeatmapOf[] = ["pieces", "practice", "stories", "projects", "all"];

/** The notes a heatmap counts, by its `of` option. Pieces are story drafts and scenes. */
export function heatmapMatch(plugin: InkwellPlugin, of: HeatmapOf): (path: string) => boolean {
  const m = modeMatchers(plugin);
  return of === "pieces" ? (p) => m.stories(p) || m.projects(p) : m[of];
}

export interface HeatmapOptions {
  weeks?: number;
  stops?: number[];
}

/** Draw a heatmap of the words in matching notes into `el`: month names above, day names beside, a legend below. */
export async function renderHeatmap(el: HTMLElement, plugin: InkwellPlugin, match: (path: string) => boolean, o: HeatmapOptions = {}): Promise<void> {
  const weeks = Math.max(1, Math.min(104, o.weeks ?? 24));
  const today = moment();
  const todayStr = today.format("YYYY-MM-DD");
  const weekStart = plugin.settings.weekStart;
  const stops = o.stops ?? [...DEFAULT_STOPS];
  const days = await plugin.words.dailyWords(match, heatmapStart(today, weeks, weekStart));
  const grid = heatmapGrid(days, today, weeks, weekStart, stops);
  const box = el.createDiv({ cls: "inkwell-heatmap" });
  // One grid, filled column by column: the first column is a corner and the day names, then each week is its
  // month name and its seven days.
  const cells = box.createDiv({ cls: "inkwell-heatmap-grid" });
  cells.setCssProps({ "--inkwell-heatmap-weeks": String(weeks) });
  cells.createDiv({ cls: "inkwell-heatmap-month" });
  for (const name of heatmapDayNames(weekStart)) cells.createDiv({ cls: "inkwell-heatmap-day", text: name });
  const months = heatmapMonths(grid);
  grid.forEach((week, w) => {
    cells.createDiv({ cls: "inkwell-heatmap-month", text: months[w] ?? "" });
    for (const d of week) {
      const cell = cells.createDiv({ cls: `inkwell-heat inkwell-heat-${d.level}` });
      if (d.future) {
        cell.addClass("is-future");
        continue;
      }
      if (d.date === todayStr) cell.addClass("is-today");
      const label = `${moment(d.date).format("ddd D MMM YYYY")} · ${d.words === 1 ? "1 word" : `${n(d.words)} words`}`;
      cell.setAttr("aria-label", label);
      // A phone has no hover: a tap shows the day instead.
      if (Platform.isMobile) cell.onclick = () => new Notice(label);
    }
  });

  const foot = box.createDiv({ cls: "inkwell-heatmap-foot" });
  const t = heatmapTotals(grid);
  const sum = foot.createDiv({ cls: "inkwell-heatmap-sum" });
  sum.createSpan({ cls: "inkwell-heatmap-sum-num", text: n(t.words) });
  sum.appendText(` words on ${t.days === 1 ? "1 day" : `${n(t.days)} days`} in the last ${weeks === 1 ? "week" : `${weeks} weeks`}`);
  const legend = foot.createDiv({ cls: "inkwell-heatmap-legend" });
  legend.createSpan({ text: "Less" });
  heatLegend(stops).forEach((label, level) => legend.createDiv({ cls: `inkwell-heat inkwell-heat-${level}`, attr: { "aria-label": label } }));
  legend.createSpan({ text: "More" });
}

/** One number in the words block: a label over it, a short line under it, and its goal's bar when one is on. */
export interface WordStat {
  label: string;
  value: string;
  /** A small word after the number ("days"). */
  unit?: string;
  /** One muted line under the number: the goal it's measured against, the daily average, the best streak. */
  caption?: string;
  goal?: { text: string; share: number; met: boolean; label: string };
}

const goalOf = (b: GoalBar | null, which: string) =>
  b && {
    text: `${n(b.words)} of ${n(b.goal)}`,
    share: b.share,
    met: b.met,
    label: b.met ? `${which} word goal met` : `${n(b.words)} of your ${which.toLowerCase()} goal of ${n(b.goal)} words`,
  };

/** "of 300 ✓": the goal a number is measured against, marked once it's met. */
const ofGoal = (b: GoalBar | null) => b && `of ${n(b.goal)}${b.met ? " ✓" : ""}`;

/**
 * What `inkwell-words` shows (spec word-log, "The words block"; spec word-goals, "Goals in the words block").
 * A goal that's off adds nothing, and a goal not yet met shows only the words so far: no warning.
 */
export function wordStats(s: WordsSummary, g: GoalProgress): WordStat[] {
  const plural = (x: number, one: string) => `${n(x)} ${one}${x === 1 ? "" : "s"}`;
  const line = (...parts: (string | null)[]) => parts.filter((p): p is string => !!p).join(" · ") || undefined;
  const today: WordStat = { label: "Today", value: n(s.today) };
  const week: WordStat = { label: "This week", value: n(s.week) };
  const todayGoal = goalOf(g.today, "Daily");
  const weekGoal = goalOf(g.week, "Weekly");
  if (todayGoal) today.goal = todayGoal;
  if (weekGoal) week.goal = weekGoal;
  const todayLine = line(ofGoal(g.today));
  const weekLine = line(ofGoal(g.week), g.goalDays === null ? null : plural(g.goalDays, "goal day"));
  if (todayLine) today.caption = todayLine;
  if (weekLine) week.caption = weekLine;
  return [
    today,
    week,
    { label: "This month", value: n(s.month), caption: `${n(s.monthAverage)} a day` },
    { label: s.streak.current > 0 ? "Streak 🔥" : "Streak", value: n(s.streak.current), unit: s.streak.current === 1 ? "day" : "days", caption: `Best ${n(s.streak.longest)}` },
  ];
}

function drawGoal(el: HTMLElement, goal: NonNullable<WordStat["goal"]>) {
  const bar = el.createEl("progress", { cls: "inkwell-progress inkwell-goal-bar" });
  bar.max = 1;
  bar.value = goal.share;
  const text = el.createDiv({ cls: "inkwell-goal", text: goal.met ? `${goal.text} ✓` : goal.text });
  for (const e of [bar, text]) e.setAttr("aria-label", goal.label);
  if (goal.met) {
    bar.addClass("is-met");
    text.addClass("is-met");
  }
}

function renderWords(box: HTMLElement, stats: WordStat[], title: string | undefined) {
  box.addClass("inkwell-block", "inkwell-words");
  if (title && title !== "none") box.createDiv({ cls: "inkwell-block-head", text: title });
  const row = box.createDiv({ cls: "inkwell-words-row" });
  for (const st of stats) {
    const el = row.createDiv({ cls: "inkwell-words-stat" });
    el.createDiv({ cls: "inkwell-label", text: st.label });
    const num = el.createDiv({ cls: "inkwell-words-num", text: st.value });
    if (st.unit) num.createSpan({ cls: "inkwell-words-unit", text: st.unit });
    // Every stat keeps its caption line, empty or not, so the rows line up across the block.
    const caption = el.createDiv({ cls: "inkwell-words-caption", text: st.caption ?? "" });
    if (st.goal) {
      const bar = el.createEl("progress", { cls: "inkwell-progress inkwell-goal-bar" });
      bar.max = 1;
      bar.value = st.goal.share;
      for (const e of [bar, caption]) e.setAttr("aria-label", st.goal.label);
      if (st.goal.met) {
        bar.addClass("is-met");
        caption.addClass("is-met");
      }
    }
  }
}

// ---------- The entries block ----------

const DAY = "YYYY-MM-DD";

/** The note an `inkwell-entries` block sits in: its frontmatter and file name. */
export interface EntriesNote {
  fm: Record<string, unknown> | undefined;
  basename: string;
}

/**
 * The day an `inkwell-entries` block shows (spec word-log, "The entries block's day"): a valid `date` option, else
 * a journal's `created` date, else a journal's file name in the journal date format, else today.
 */
export function entriesDay(option: string | undefined, note: EntriesNote | null, today: moment.Moment, journalFormat: string): string {
  const strict = (s: string, format: string) => {
    const m = moment(s.trim(), format, true);
    return m.isValid() ? m.format(DAY) : null;
  };
  const fromOption = option ? strict(option, DAY) : null;
  if (fromOption) return fromOption;
  if (note && fmStr(note.fm?.type) === "journal") {
    const day = strict(fmStr(note.fm?.created), DAY) ?? strict(note.basename, journalFormat || DAY);
    if (day) return day;
  }
  return today.format(DAY);
}

/** What `inkwell-entries` shows: each note's name and words, whether it can be linked, and the total with its goal. */
export interface EntriesView {
  entries: { path: string; name: string; words: string; link: boolean }[];
  total: string;
  goal?: WordStat["goal"];
  empty: boolean;
}

const words = (x: number) => `${n(x)} ${Math.abs(x) === 1 ? "word" : "words"}`;

/** The entries block's content (spec word-log, "The entries block"). A daily goal of 0 is off and shows the total alone. */
export function entriesView(day: { entries: DayEntry[]; total: number }, exists: (path: string) => boolean, dailyGoal: number): EntriesView {
  const view: EntriesView = {
    entries: day.entries.map((e) => ({
      path: e.path,
      name: (e.path.split("/").pop() ?? e.path).replace(/\.md$/, ""),
      words: words(e.words),
      link: exists(e.path),
    })),
    total: words(day.total),
    empty: day.entries.length === 0,
  };
  const goal = goalOf(goalBar(day.total, dailyGoal), "Daily");
  if (goal) view.goal = goal;
  return view;
}

function renderEntries(box: HTMLElement, plugin: InkwellPlugin, view: EntriesView, sourcePath: string, hoverParent: LiveBlock, title: string | undefined) {
  box.addClass("inkwell-block", "inkwell-entries");
  if (title && title !== "none") box.createDiv({ cls: "inkwell-block-head", text: title });
  if (view.empty) {
    box.createDiv({ cls: "inkwell-muted", text: "Nothing written in writing blocks on this day." });
    return;
  }
  const ul = box.createEl("ul", { cls: "inkwell-entries-list" });
  for (const e of view.entries) {
    const li = ul.createEl("li");
    if (e.link) {
      const a = li.createEl("a", { cls: "internal-link", text: e.name, attr: { "data-href": e.path, href: e.path } });
      a.onclick = (ev) => {
        ev.preventDefault();
        void plugin.app.workspace.openLinkText(e.path, sourcePath, Keymap.isModEvent(ev));
      };
      // Hovering previews the note, like any internal link in reading view.
      a.onmouseover = (event) =>
        plugin.app.workspace.trigger("hover-link", { event, source: "preview", hoverParent, targetEl: a, linktext: e.path, sourcePath });
    } else {
      li.createSpan({ cls: "inkwell-muted", text: e.name });
    }
    li.createSpan({ cls: "inkwell-entries-words", text: e.words });
  }
  const total = box.createDiv({ cls: "inkwell-entries-total" });
  total.createSpan({ cls: "inkwell-label", text: "Total" });
  total.createSpan({ cls: "inkwell-entries-words", text: view.total });
  if (view.goal) drawGoal(box.createDiv({ cls: "inkwell-entries-goal" }), view.goal);
}

export function registerWordBlocks(plugin: InkwellPlugin): void {
  // ```inkwell-heatmap```  (options: weeks: 24, of: pieces|practice|stories|projects|all, stops: 1, 100, 500, 1000)
  plugin.registerMarkdownCodeBlockProcessor("inkwell-heatmap", (src, el, ctx) => {
    const o = opts(src);
    const of = HEATMAP_OF.includes(o.of as HeatmapOf) ? (o.of as HeatmapOf) : "pieces";
    const weeks = parseInt(o.weeks ?? "", 10) || 24;
    const stops = parseStops(o.stops);
    ctx.addChild(new LiveBlock(el, plugin, (box) => renderHeatmap(box, plugin, heatmapMatch(plugin, of), { weeks, stops })));
  });

  // ```inkwell-words```  (option: title: <text>|none)
  plugin.registerMarkdownCodeBlockProcessor("inkwell-words", (src, el, ctx) => {
    const o = opts(src);
    ctx.addChild(
      new LiveBlock(el, plugin, async (box) => {
        const days = await plugin.words.allDays();
        renderWords(box, wordStats(wordsSummary(days, moment(), plugin.settings.weekStart), await plugin.words.goals(days)), o.title);
      })
    );
  });

  // ```inkwell-entries```  (options: date: YYYY-MM-DD, title: <text>|none)
  plugin.registerMarkdownCodeBlockProcessor("inkwell-entries", (src, el, ctx) => {
    const o = opts(src);
    ctx.addChild(
      new LiveBlock(el, plugin, async (box, child) => {
        const { app, settings } = plugin;
        const file = app.vault.getFileByPath(ctx.sourcePath);
        const note = file ? { fm: fmOf(app, file), basename: file.basename } : null;
        const day = entriesDay(o.date, note, moment(), settings.journalDateFormat);
        const view = entriesView(await plugin.words.dayEntries(day), (p) => !!app.vault.getFileByPath(p), settings.dailyWordGoal);
        renderEntries(box, plugin, view, ctx.sourcePath, child, o.title);
      })
    );
  });
}
