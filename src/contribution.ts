/**
 * Progress & motivation blocks (see CLAUDE.md → Progress & motivation model).
 *
 * ```inkwell-practice```      Session/day level: did I show up this week?
 * ```inkwell-contribution```  Mode level: what did I add to each part of my writing?
 *
 * Counts come from frontmatter Inkwell already writes (type, created, prompt…).
 * Word numbers come from Keep the Rhythm and are hidden when it's unavailable.
 */
import { moment, normalizePath, TFile } from "obsidian";
import { fmOf, fmStr } from "./util";
import type InkwellPlugin from "./main";
import { LiveBlock, opts } from "./homeblocks";

const DAY = "YYYY-MM-DD";

/** A frontmatter date (or datetime) as YYYY-MM-DD, or "" if missing/invalid. */
export function fmDay(v: unknown): string {
  if (v === undefined || v === null || v === "") return "";
  const s = fmStr(v);
  if (!s) return "";
  const m = moment(s);
  return m.isValid() ? m.format(DAY) : "";
}

const under = (path: string, folder: string) => path.startsWith(normalizePath(folder) + "/");

export interface Note {
  file: TFile;
  fm: Record<string, unknown>;
  type: string;
  created: string;
}

/** Every Markdown note with frontmatter, read once from the metadata cache. */
export function allNotes(plugin: InkwellPlugin): Note[] {
  const out: Note[] = [];
  for (const file of plugin.app.vault.getMarkdownFiles()) {
    const fm = fmOf(plugin.app, file);
    if (!fm) continue;
    out.push({ file, fm, type: fmStr(fm.type), created: fmDay(fm.created) });
  }
  return out;
}

/** Path matchers for word counts by mode (same rules as the heatmap: drafts and scenes only for pieces). */
export function modeMatchers(plugin: InkwellPlugin) {
  const f = plugin.settings.folders;
  return {
    practice: (p: string) => under(p, f.journal) || under(p, f.writings),
    stories: (p: string) => under(p, f.writing) && p.endsWith(" - Draft.md") && !p.includes("/Archive/"),
    projects: (p: string) => under(p, f.longProjects) && p.includes("/Scenes/"),
    all: (_p: string) => true,
  };
}

const n = (x: number) => x.toLocaleString();
const plural = (x: number, one: string, many = one + "s") => `${n(x)} ${x === 1 ? one : many}`;

// ---------- Session / day: inkwell-practice ----------

export interface PracticeWeek {
  days: { date: string; showed: boolean; future: boolean }[];
  exercises: number;
  prompts: number;
  journals: number;
  /** Minutes logged by the writing timer (`writing_min`) on this week's journals and exercises. */
  minutes: number;
  practiceWords: number | null;
  streak: { current: number; highest: number } | null;
}

/**
 * A day counts as "showed up" if you wrote anything that day (Keep the Rhythm),
 * or did an exercise. Without Keep the Rhythm, a journal entry for that day also counts.
 */
export async function practiceWeek(plugin: InkwellPlugin): Promise<PracticeWeek> {
  const { ktr, settings } = plugin;
  const start = await ktr.weekStart();
  const today = moment().format(DAY);
  const end = moment(start).add(6, "days").format(DAY);
  const inWeek = (d: string) => d >= start && d <= end;

  const notes = allNotes(plugin);
  const exercises = notes.filter((x) => x.type === "exercise" && inWeek(x.created));
  const journals = notes.filter((x) => x.type === "journal" && under(x.file.path, settings.folders.journal) && inWeek(x.created));

  const anyWords = await ktr.dailyWords(() => true, start, end);
  const active = new Set<string>(exercises.map((x) => x.created));
  if (anyWords) {
    for (const [d, w] of anyWords) if (w > 0) active.add(d);
  } else {
    for (const j of journals) active.add(j.created);
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = moment(start).add(i, "days").format(DAY);
    return { date, showed: active.has(date), future: date > today };
  });

  return {
    days,
    exercises: exercises.length,
    prompts: exercises.filter((x) => !!x.fm.prompt).length,
    journals: journals.length,
    minutes: [...exercises, ...journals].reduce((sum, x) => sum + (Number(x.fm.writing_min) || 0), 0),
    practiceWords: await ktr.words(modeMatchers(plugin).practice, start, end),
    streak: await ktr.streak(),
  };
}

function renderPractice(box: HTMLElement, w: PracticeWeek, title: string | undefined) {
  box.addClass("inkwell-block", "inkwell-practice");
  const head = box.createDiv({ cls: "inkwell-block-head" });
  if (title !== "none") head.createSpan({ text: title || "Practice this week" });
  if (w.streak) {
    const s = head.createSpan({ cls: "inkwell-streak", text: `🔥 ${plural(w.streak.current, "day")}` });
    s.setAttr("aria-label", `Current streak · best ${plural(w.streak.highest, "day")}`);
  }

  const row = box.createDiv({ cls: "inkwell-week" });
  const strip = row.createDiv({ cls: "inkwell-week-days" });
  const today = moment().format(DAY);
  for (const d of w.days) {
    const cell = strip.createDiv({ cls: "inkwell-day" });
    if (d.showed) cell.addClass("is-done");
    if (d.future) cell.addClass("is-future");
    if (d.date === today) cell.addClass("is-today");
    cell.setText(moment(d.date).format("dd").charAt(0));
    cell.setAttr("aria-label", moment(d.date).format("ddd D MMM") + (d.showed ? " · showed up" : ""));
  }
  const shown = w.days.filter((d) => d.showed).length;
  const elapsed = w.days.filter((d) => !d.future).length;
  row.createSpan({ cls: "inkwell-week-count", text: `${shown} of ${elapsed} ${elapsed === 1 ? "day" : "days"}` });

  const parts = [
    plural(w.exercises, "exercise"),
    plural(w.prompts, "prompt") + " used",
    plural(w.journals, "journal entry", "journal entries"),
  ];
  if (w.minutes > 0) parts.push(plural(w.minutes, "minute") + " written");
  if (w.practiceWords !== null) parts.push(`${n(w.practiceWords)} practice words`);
  box.createDiv({ cls: "inkwell-muted", text: parts.join(" · ") });
}

// ---------- Mode level: inkwell-contribution ----------

export type Period = "week" | "month" | "year" | "all";
const PERIODS: Period[] = ["week", "month", "year", "all"];
const PERIOD_LABEL: Record<Period, string> = { week: "This week", month: "This month", year: "This year", all: "All time" };

export interface Contribution {
  period: Period;
  from: string;
  capture: { captured: number; sorted: number };
  practice: { exercises: number; journals: number; prompts: number; words: number | null };
  stories: { started: number; fromPractice: number; revisions: number; words: number | null };
  projects: { started: number; promoted: number; scenes: number; words: number | null };
  words: number | null;
}

async function periodStart(plugin: InkwellPlugin, p: Period): Promise<string> {
  if (p === "week") return plugin.ktr.weekStart();
  if (p === "month") return moment().startOf("month").format(DAY);
  if (p === "year") return moment().startOf("year").format(DAY);
  return "0000-00-00";
}

export async function contribution(plugin: InkwellPlugin, period: Period): Promise<Contribution> {
  const { ktr, settings } = plugin;
  const from = await periodStart(plugin, period);
  const to = moment().format(DAY);
  const inRange = (d: string) => !!d && d >= from && d <= to;
  const notes = allNotes(plugin);
  const of = (type: string) => notes.filter((x) => x.type === type && inRange(x.created));

  // Captures keep `captured` through triage; older captures only have type + created.
  const inbox = normalizePath(settings.folders.inbox);
  const captures = notes.filter((x) =>
    x.fm.captured ? inRange(fmDay(x.fm.captured)) : x.type === "capture" && inRange(x.created)
  );
  const exercises = of("exercise");
  const stories = of("story");
  const hubs = notes.filter((x) => x.type === "storyline");
  const m = modeMatchers(plugin);

  return {
    period,
    from,
    capture: { captured: captures.length, sorted: captures.filter((x) => x.file.parent?.path !== inbox).length },
    practice: {
      exercises: exercises.length,
      journals: of("journal").length,
      prompts: exercises.filter((x) => !!x.fm.prompt).length,
      words: await ktr.words(m.practice, from, to),
    },
    stories: {
      started: stories.length,
      fromPractice: stories.filter((x) => !!x.fm.from).length,
      revisions: notes.filter((x) => inRange(fmDay(x.fm.snapshot))).length,
      words: await ktr.words(m.stories, from, to),
    },
    projects: {
      started: hubs.filter((x) => !x.fm.promoted && inRange(x.created)).length,
      promoted: hubs.filter((x) => inRange(fmDay(x.fm.promoted))).length,
      scenes: of("scene").length,
      words: await ktr.words(m.projects, from, to),
    },
    words: await ktr.words(m.all, from, to),
  };
}

function renderContribution(box: HTMLElement, c: Contribution, title: string | undefined, onPeriod: (p: Period) => void) {
  box.addClass("inkwell-block", "inkwell-contribution");
  const head = box.createDiv({ cls: "inkwell-block-head" });
  if (title !== "none") head.createSpan({ text: title || "Your contribution" });
  if (c.words !== null) head.createSpan({ cls: "inkwell-contribution-total", text: `${n(c.words)} words` });
  const tabs = head.createDiv({ cls: "inkwell-period" });
  for (const p of PERIODS) {
    const b = tabs.createEl("button", { text: PERIOD_LABEL[p] });
    if (p === c.period) b.addClass("is-active");
    b.onclick = () => onPeriod(p);
  }

  const grid = box.createDiv({ cls: "inkwell-contribution-grid" });
  const card = (name: string, lines: [number | null, string][]) => {
    const el = grid.createDiv({ cls: "inkwell-contribution-card" });
    el.createDiv({ cls: "inkwell-label", text: name });
    for (const [v, label] of lines) {
      if (v === null) continue;
      const line = el.createDiv({ cls: "inkwell-contribution-line" });
      line.createSpan({ cls: "inkwell-contribution-num", text: n(v) });
      line.createSpan({ text: " " + label });
    }
  };
  card("Capture", [
    [c.capture.captured, c.capture.captured === 1 ? "idea captured" : "ideas captured"],
    [c.capture.sorted, "sorted"],
  ]);
  card("Practice", [
    [c.practice.exercises, c.practice.exercises === 1 ? "exercise" : "exercises"],
    [c.practice.journals, c.practice.journals === 1 ? "journal entry" : "journal entries"],
    [c.practice.prompts, c.practice.prompts === 1 ? "prompt used" : "prompts used"],
    [c.practice.words, "words"],
  ]);
  card("Stories", [
    [c.stories.started, "started"],
    [c.stories.fromPractice, "grew from practice"],
    [c.stories.revisions, c.stories.revisions === 1 ? "revision" : "revisions"],
    [c.stories.words, "draft words"],
  ]);
  card("Projects", [
    [c.projects.started, "started"],
    [c.projects.promoted, "promoted from stories"],
    [c.projects.scenes, c.projects.scenes === 1 ? "scene added" : "scenes added"],
    [c.projects.words, "scene words"],
  ]);
}

export function registerContributionBlocks(plugin: InkwellPlugin): void {
  // ```inkwell-practice```  (option: title: <text>|none)
  plugin.registerMarkdownCodeBlockProcessor("inkwell-practice", (src, el, ctx) => {
    const o = opts(src);
    ctx.addChild(new LiveBlock(el, plugin, async (box) => renderPractice(box, await practiceWeek(plugin), o.title)));
  });

  // ```inkwell-contribution```  (options: period: week|month|year|all, title: <text>|none)
  plugin.registerMarkdownCodeBlockProcessor("inkwell-contribution", (src, el, ctx) => {
    const o = opts(src);
    let period: Period = PERIODS.includes(o.period as Period) ? (o.period as Period) : "month";
    const block = new LiveBlock(el, plugin, async (box) =>
      renderContribution(box, await contribution(plugin, period), o.title, (p) => {
        period = p;
        void block.redraw();
      })
    );
    ctx.addChild(block);
  });
}
