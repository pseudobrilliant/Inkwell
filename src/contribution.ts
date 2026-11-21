/**
 * Progress & motivation blocks (see CLAUDE.md → Progress & motivation model).
 *
 * ```inkwell-practice```      Session/day level: did I show up this week?
 *
 * Counts come from frontmatter Inkwell already writes (type, created, prompt…).
 * Word numbers come from Keep the Rhythm and are hidden when it's unavailable.
 */
import { moment, normalizePath, TFile } from "obsidian";
import type InkwellPlugin from "./main";
import { LiveBlock, opts } from "./homeblocks";

const DAY = "YYYY-MM-DD";

/** A frontmatter date (or datetime) as YYYY-MM-DD, or "" if missing/invalid. */
export function fmDay(v: unknown): string {
  if (v === undefined || v === null || v === "") return "";
  const m = moment(String(v));
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
    const fm = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm) continue;
    out.push({ file, fm, type: String(fm.type ?? ""), created: fmDay(fm.created) });
  }
  return out;
}

/** Path matchers for word counts by mode (same rules as the heatmap: drafts and scenes only for pieces). */
export function modeMatchers(plugin: InkwellPlugin) {
  const f = plugin.settings.folders;
  return {
    practice: (p: string) => under(p, f.journal) || under(p, f.exercises),
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
  if (w.practiceWords !== null) parts.push(`${n(w.practiceWords)} practice words`);
  box.createDiv({ cls: "inkwell-muted", text: parts.join(" · ") });
}

export function registerContributionBlocks(plugin: InkwellPlugin): void {
  // ```inkwell-practice```  (option: title: <text>|none)
  plugin.registerMarkdownCodeBlockProcessor("inkwell-practice", (src, el, ctx) => {
    const o = opts(src);
    ctx.addChild(new LiveBlock(el, plugin, async (box) => renderPractice(box, await practiceWeek(plugin), o.title)));
  });
}
