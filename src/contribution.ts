/**
 * Progress & motivation blocks (see CLAUDE.md → Progress & motivation model).
 *
 * ```inkwell-practice```      Session/day level: did I show up this week?
 * ```inkwell-contribution```  Mode level: what did I add to each part of my writing?
 * ```inkwell-recent```        The practice you worked on last: exercises and journal entries, newest first.
 *
 * Counts come from frontmatter Inkwell already writes (type, created, prompt…).
 * Word numbers come from Inkwell's word log (`plugin.words`, spec word-log): words typed in writing blocks.
 */
import { Keymap, moment, normalizePath, setIcon, TFile } from "obsidian";
import { fmDay, fmOf, fmStr } from "./util";

export { fmDay } from "./util";
import type InkwellPlugin from "./main";
import { LiveBlock, opts } from "./homeblocks";
import { isGoalDay, type Streak } from "./wordlog";

const DAY = "YYYY-MM-DD";

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
    // All your writing: everything except notes on what you read (resources), and the word log itself.
    all: (p: string) => !under(p, f.resources) && !under(p, f.wordLog),
  };
}

const n = (x: number) => x.toLocaleString();
const plural = (x: number, one: string, many = one + "s") => `${n(x)} ${x === 1 ? one : many}`;

// ---------- Session / day: inkwell-practice ----------

export interface PracticeWeek {
  /** `goal`: the day's words reached the daily goal (spec word-goals). Never set when the goal is off. */
  days: { date: string; showed: boolean; goal: boolean; future: boolean }[];
  exercises: number;
  prompts: number;
  journals: number;
  /** Minutes logged by the writing timer (`writing_min`) on this week's journals and exercises. */
  minutes: number;
  practiceWords: number;
  streak: Streak;
}

/**
 * A day counts as "showed up" when the words you typed in writing blocks that day, across all your writing, add up to
 * more than zero. Making an exercise or a journal entry alone doesn't count (spec word-log).
 */
export async function practiceWeek(plugin: InkwellPlugin): Promise<PracticeWeek> {
  const { words, settings } = plugin;
  const start = words.weekStart();
  const today = moment().format(DAY);
  const end = moment(start).add(6, "days").format(DAY);
  const inWeek = (d: string) => d >= start && d <= end;

  const notes = allNotes(plugin);
  const exercises = notes.filter((x) => x.type === "exercise" && inWeek(x.created));
  const journals = notes.filter((x) => x.type === "journal" && under(x.file.path, settings.folders.journal) && inWeek(x.created));

  const m = modeMatchers(plugin);
  const daily = await words.dailyWords(m.all, start, end);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = moment(start).add(i, "days").format(DAY);
    const w = daily.get(date) ?? 0;
    return { date, showed: w > 0, goal: isGoalDay(w, settings.dailyWordGoal), future: date > today };
  });

  return {
    days,
    exercises: exercises.length,
    prompts: exercises.filter((x) => !!x.fm.prompt).length,
    journals: journals.length,
    minutes: [...exercises, ...journals].reduce((sum, x) => sum + (Number(x.fm.writing_min) || 0), 0),
    practiceWords: await words.words(m.practice, start, end),
    streak: await words.streak(),
  };
}

/** The week's practice numbers, as the tiles under the week strip show them: label and number. */
export function practiceStats(w: PracticeWeek): { label: string; value: string }[] {
  return [
    { label: w.exercises === 1 ? "Exercise" : "Exercises", value: n(w.exercises) },
    { label: "Prompts used", value: n(w.prompts) },
    { label: w.journals === 1 ? "Journal entry" : "Journal entries", value: n(w.journals) },
    { label: "Minutes written", value: n(w.minutes) },
    { label: "Practice words", value: n(w.practiceWords) },
  ];
}

function renderPractice(box: HTMLElement, w: PracticeWeek, title: string | undefined) {
  box.addClass("inkwell-block", "inkwell-practice");
  if (title !== "none") box.createDiv({ cls: "inkwell-block-head", text: title || "Practice this week" });

  // The week: the days you showed up, how many so far, and the streak, on one row.
  const top = box.createDiv({ cls: "inkwell-practice-top" });
  const row = top.createDiv({ cls: "inkwell-week" });
  const strip = row.createDiv({ cls: "inkwell-week-days" });
  const today = moment().format(DAY);
  for (const d of w.days) {
    const cell = strip.createDiv({ cls: "inkwell-day" });
    if (d.showed) cell.addClass("is-done");
    if (d.goal) cell.addClass("is-goal");
    if (d.future) cell.addClass("is-future");
    if (d.date === today) cell.addClass("is-today");
    cell.setText(moment(d.date).format("dd").charAt(0));
    // A day under the goal reads as showed up, never as a missed goal (spec word-goals, "Goals don't scold").
    cell.setAttr("aria-label", moment(d.date).format("ddd D MMM") + (d.goal ? " · goal met" : d.showed ? " · showed up" : ""));
  }
  const shown = w.days.filter((d) => d.showed).length;
  const elapsed = w.days.filter((d) => !d.future).length;
  const count = row.createDiv({ cls: "inkwell-week-count" });
  count.createDiv({ cls: "inkwell-practice-big", text: `${shown} of ${elapsed}` });
  count.createDiv({ cls: "inkwell-muted", text: `${elapsed === 1 ? "day" : "days"} this week` });

  const streak = top.createDiv({ cls: "inkwell-streak" });
  streak.setAttr("aria-label", `Current streak · best ${plural(w.streak.longest, "day")}`);
  streak.createDiv({ cls: "inkwell-practice-big", text: `🔥 ${n(w.streak.current)}` });
  streak.createDiv({ cls: "inkwell-muted", text: `${w.streak.current === 1 ? "day" : "days"} in a row · best ${n(w.streak.longest)}` });

  // What the week added up to: one tile per number.
  const stats = box.createDiv({ cls: "inkwell-practice-stats" });
  for (const st of practiceStats(w)) {
    const tile = stats.createDiv({ cls: "inkwell-practice-stat" });
    tile.createDiv({ cls: "inkwell-practice-num", text: st.value });
    tile.createDiv({ cls: "inkwell-label", text: st.label });
  }
}

// ---------- Mode level: inkwell-contribution ----------

export type Period = "week" | "month" | "year" | "all";
const PERIODS: Period[] = ["week", "month", "year", "all"];
const PERIOD_LABEL: Record<Period, string> = { week: "This week", month: "This month", year: "This year", all: "All time" };

export interface Contribution {
  period: Period;
  from: string;
  capture: { captured: number; sorted: number };
  /** Others' work taken in: resources added in the period, and how many of those are being read or done. */
  well: { added: number; reading: number; done: number };
  practice: { exercises: number; journals: number; prompts: number; words: number };
  stories: { started: number; fromPractice: number; revisions: number; words: number };
  projects: { started: number; promoted: number; scenes: number; words: number };
  words: number;
}

function periodStart(plugin: InkwellPlugin, p: Period): string {
  if (p === "week") return plugin.words.weekStart();
  if (p === "month") return moment().startOf("month").format(DAY);
  if (p === "year") return moment().startOf("year").format(DAY);
  return "0000-00-00";
}

export async function contribution(plugin: InkwellPlugin, period: Period): Promise<Contribution> {
  const { words, settings } = plugin;
  const from = periodStart(plugin, period);
  const to = moment().format(DAY);
  const inRange = (d: string) => !!d && d >= from && d <= to;
  const notes = allNotes(plugin);
  const of = (type: string) => notes.filter((x) => x.type === type && inRange(x.created));

  // Captures keep `captured` through triage; older captures only have type + created.
  const inbox = normalizePath(settings.folders.inbox);
  // Resources have their own card (feed the well), so they aren't counted as ideas too.
  const captures = notes.filter((x) =>
    x.type === "resource" ? false : x.fm.captured ? inRange(fmDay(x.fm.captured)) : x.type === "capture" && inRange(x.created)
  );
  const resources = notes.filter((x) => x.type === "resource" && inRange(fmDay(x.fm.captured) || x.created));
  const resourceStatus = (s: string) => resources.filter((x) => fmStr(x.fm.status) === s).length;
  const exercises = of("exercise");
  const stories = of("story");
  const hubs = notes.filter((x) => x.type === "storyline");
  const m = modeMatchers(plugin);

  return {
    period,
    from,
    capture: { captured: captures.length, sorted: captures.filter((x) => x.file.parent?.path !== inbox).length },
    well: { added: resources.length, reading: resourceStatus("in-progress"), done: resourceStatus("done") },
    practice: {
      exercises: exercises.length,
      journals: of("journal").length,
      prompts: exercises.filter((x) => !!x.fm.prompt).length,
      words: await words.words(m.practice, from, to),
    },
    stories: {
      started: stories.length,
      fromPractice: stories.filter((x) => !!x.fm.from).length,
      revisions: notes.filter((x) => inRange(fmDay(x.fm.snapshot))).length,
      words: await words.words(m.stories, from, to),
    },
    projects: {
      started: hubs.filter((x) => !x.fm.promoted && inRange(x.created)).length,
      promoted: hubs.filter((x) => inRange(fmDay(x.fm.promoted))).length,
      scenes: of("scene").length,
      words: await words.words(m.projects, from, to),
    },
    words: await words.words(m.all, from, to),
  };
}

function renderContribution(box: HTMLElement, c: Contribution, title: string | undefined, onPeriod: (p: Period) => void) {
  box.addClass("inkwell-block", "inkwell-contribution");
  const head = box.createDiv({ cls: "inkwell-block-head" });
  if (title !== "none") head.createSpan({ text: title || "Your contribution" });
  head.createSpan({ cls: "inkwell-contribution-total", text: `${n(c.words)} words` });
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
  card("Feed the well", [
    [c.well.added, c.well.added === 1 ? "resource added" : "resources added"],
    [c.well.reading, "reading"],
    [c.well.done, "done"],
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

// ---------- Recent practice: inkwell-recent ----------

/** A practice note as `inkwell-recent` reads it. */
export interface PracticeNote {
  path: string;
  basename: string;
  type: string;
  created: string;
  /** Last modified, in milliseconds. */
  mtime: number;
  minutes: number;
}

/** One row of `inkwell-recent`. */
export interface RecentRow {
  path: string;
  kind: "exercise" | "journal";
  title: string;
  /** "15 min", or "" when the timer logged nothing. */
  minutes: string;
  /** When it was last worked on: "Today", "Yesterday", a weekday this past week, else a date. */
  when: string;
}

/** When a note was last worked on, in words, as seen from `today`. */
export function whenWorked(mtime: number, today: moment.Moment): string {
  const day = moment(mtime).startOf("day");
  const ago = today.clone().startOf("day").diff(day, "days");
  if (ago <= 0) return "Today";
  if (ago === 1) return "Yesterday";
  if (ago < 7) return day.format("dddd");
  return day.format(day.year() === today.year() ? "D MMM" : "D MMM YYYY");
}

/**
 * The rows of `inkwell-recent`: exercises and journal entries, last worked on first. A journal is titled by its
 * day ("Friday 27 Nov"), from `created` or else its file name in the journal date format.
 */
export function recentPractice(notes: readonly PracticeNote[], today: moment.Moment, limit: number, journalFormat: string): RecentRow[] {
  return notes
    .filter((x) => x.type === "exercise" || x.type === "journal")
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, Math.max(1, limit))
    .map((x) => {
      const kind = x.type === "journal" ? "journal" : "exercise";
      let title = x.basename;
      if (kind === "journal") {
        const d = [moment(x.created, DAY, true), moment(x.basename, journalFormat || DAY, true)].find((m) => m.isValid());
        if (d) title = d.format(d.year() === today.year() ? "dddd D MMM" : "dddd D MMM YYYY");
      }
      return { path: x.path, kind, title, minutes: x.minutes > 0 ? `${n(x.minutes)} min` : "", when: whenWorked(x.mtime, today) };
    });
}

async function renderRecent(box: HTMLElement, plugin: InkwellPlugin, hoverParent: LiveBlock, sourcePath: string, o: Record<string, string>) {
  const { app, settings } = plugin;
  box.addClass("inkwell-block", "inkwell-recent");
  if (o.title !== "none") box.createDiv({ cls: "inkwell-prompt-label", text: o.title || "Recent practice" });
  const practice = (p: string) => under(p, settings.folders.journal) || under(p, settings.folders.writings);
  const notes: PracticeNote[] = allNotes(plugin)
    .filter((x) => practice(x.file.path))
    .map((x) => ({
      path: x.file.path,
      basename: x.file.basename,
      type: x.type,
      created: x.created,
      mtime: x.file.stat.mtime,
      minutes: Number(x.fm.writing_min) || 0,
    }));
  const rows = recentPractice(notes, moment(), parseInt(o.limit ?? "", 10) || 7, settings.journalDateFormat);
  if (!rows.length) {
    box.createDiv({ cls: "inkwell-muted", text: "No exercises or journal entries yet." });
    return;
  }
  const list = box.createDiv({ cls: "inkwell-recent-list" });
  for (const r of rows) {
    const row = list.createDiv({ cls: `inkwell-recent-row is-${r.kind}` });
    setIcon(row.createSpan({ cls: "inkwell-recent-icon", attr: { "aria-label": r.kind === "journal" ? "Journal" : "Exercise" } }), r.kind === "journal" ? "notebook-pen" : "pen-line");
    const a = row.createEl("a", { cls: "inkwell-recent-title internal-link", text: r.title, attr: { "data-href": r.path, href: r.path } });
    a.onclick = (ev) => {
      ev.preventDefault();
      void app.workspace.openLinkText(r.path, sourcePath, Keymap.isModEvent(ev));
    };
    // Hovering previews the note, like any internal link in reading view.
    a.onmouseover = (event) => app.workspace.trigger("hover-link", { event, source: "preview", hoverParent, targetEl: a, linktext: r.path, sourcePath });
    const words = await plugin.words.words((p) => p === r.path, "1970-01-01");
    const meta = row.createSpan({ cls: "inkwell-recent-meta" });
    for (const part of [words > 0 ? plural(words, "word") : "", r.minutes]) if (part) meta.createSpan({ text: part });
    row.createSpan({ cls: "inkwell-recent-when", text: r.when });
  }
}

export function registerContributionBlocks(plugin: InkwellPlugin): void {
  // ```inkwell-practice```  (option: title: <text>|none)
  plugin.registerMarkdownCodeBlockProcessor("inkwell-practice", (src, el, ctx) => {
    const o = opts(src);
    ctx.addChild(new LiveBlock(el, plugin, async (box) => renderPractice(box, await practiceWeek(plugin), o.title)));
  });

  // ```inkwell-recent```  (options: limit: 7, title: <text>|none)
  plugin.registerMarkdownCodeBlockProcessor("inkwell-recent", (src, el, ctx) => {
    const o = opts(src);
    ctx.addChild(new LiveBlock(el, plugin, (box, child) => renderRecent(box, plugin, child, ctx.sourcePath, o)));
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
