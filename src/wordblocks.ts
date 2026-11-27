/**
 * Word blocks drawn by Inkwell from its word log (spec word-log, "Heatmap" and "The words block"):
 *
 * ```inkwell-heatmap```  One square per day for the last N weeks, shaded by words typed in writing blocks.
 * ```inkwell-words```    Words today, this week and this month, the streak, and the daily and weekly goals.
 *
 * The heatmap's layout and shades are pure (`heatmapGrid` in src/wordlog.ts); this file only draws them.
 */
import { moment, Notice, Platform } from "obsidian";
import type InkwellPlugin from "./main";
import { modeMatchers } from "./contribution";
import { LiveBlock, opts } from "./homeblocks";
import { heatmapGrid, heatmapStart, parseStops, wordsSummary, type GoalBar, type GoalProgress, type WordsSummary } from "./wordlog";

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

/** Draw a heatmap of the words in matching notes into `el`. */
export async function renderHeatmap(el: HTMLElement, plugin: InkwellPlugin, match: (path: string) => boolean, o: HeatmapOptions = {}): Promise<void> {
  const weeks = Math.max(1, Math.min(104, o.weeks ?? 24));
  const today = moment();
  const weekStart = plugin.settings.weekStart;
  const days = await plugin.words.dailyWords(match, heatmapStart(today, weeks, weekStart));
  const grid = heatmapGrid(days, today, weeks, weekStart, o.stops);
  const box = el.createDiv({ cls: "inkwell-heatmap" });
  const cells = box.createDiv({ cls: "inkwell-heatmap-grid" });
  cells.setCssProps({ "--inkwell-heatmap-weeks": String(weeks) });
  for (const week of grid) {
    for (const d of week) {
      const cell = cells.createDiv({ cls: `inkwell-heat inkwell-heat-${d.level}` });
      if (d.future) {
        cell.addClass("is-future");
        continue;
      }
      const label = `${moment(d.date).format("ddd D MMM YYYY")} · ${d.words === 1 ? "1 word" : `${n(d.words)} words`}`;
      cell.setAttr("aria-label", label);
      // A phone has no hover: a tap shows the day instead.
      if (Platform.isMobile) cell.onclick = () => new Notice(label);
    }
  }
}

/** One number in the words block, with its goal when one is on. */
export interface WordStat {
  value: string;
  label: string;
  sub?: string;
  goal?: { text: string; share: number; met: boolean; label: string };
}

const goalOf = (b: GoalBar | null, which: string) =>
  b && {
    text: `${n(b.words)} of ${n(b.goal)}`,
    share: b.share,
    met: b.met,
    label: b.met ? `${which} word goal met` : `${n(b.words)} of your ${which.toLowerCase()} goal of ${n(b.goal)} words`,
  };

/**
 * What `inkwell-words` shows (spec word-log, "The words block"; spec word-goals, "Goals in the words block").
 * A goal that's off adds nothing, and a goal not yet met shows only the words so far: no warning.
 */
export function wordStats(s: WordsSummary, g: GoalProgress): WordStat[] {
  const plural = (x: number, one: string) => `${n(x)} ${one}${x === 1 ? "" : "s"}`;
  const today: WordStat = { value: n(s.today), label: "Today" };
  const week: WordStat = { value: n(s.week), label: "This week" };
  const todayGoal = goalOf(g.today, "Daily");
  const weekGoal = goalOf(g.week, "Weekly");
  if (todayGoal) today.goal = todayGoal;
  if (weekGoal) week.goal = weekGoal;
  if (g.goalDays !== null) week.sub = plural(g.goalDays, "goal day");
  return [
    today,
    week,
    { value: n(s.month), label: "This month", sub: `${n(s.monthAverage)} a day` },
    { value: `🔥 ${n(s.streak.current)}`, label: s.streak.current === 1 ? "Day in a row" : "Days in a row", sub: `Best ${n(s.streak.longest)}` },
  ];
}

function renderWords(box: HTMLElement, stats: WordStat[], title: string | undefined) {
  box.addClass("inkwell-block", "inkwell-words");
  if (title && title !== "none") box.createDiv({ cls: "inkwell-block-head", text: title });
  const row = box.createDiv({ cls: "inkwell-words-row" });
  for (const st of stats) {
    const el = row.createDiv({ cls: "inkwell-words-stat" });
    el.createDiv({ cls: "inkwell-words-num", text: st.value });
    el.createDiv({ cls: "inkwell-label", text: st.label });
    if (st.goal) {
      const bar = el.createEl("progress", { cls: "inkwell-progress inkwell-goal-bar" });
      bar.max = 1;
      bar.value = st.goal.share;
      const text = el.createDiv({ cls: "inkwell-goal", text: st.goal.met ? `${st.goal.text} ✓` : st.goal.text });
      for (const e of [bar, text]) e.setAttr("aria-label", st.goal.label);
      if (st.goal.met) {
        bar.addClass("is-met");
        text.addClass("is-met");
      }
    }
    if (st.sub) el.createDiv({ cls: "inkwell-muted", text: st.sub });
  }
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
}
