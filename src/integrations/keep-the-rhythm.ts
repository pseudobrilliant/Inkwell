/**
 * Keep the Rhythm (KTR) integration — the ONLY file that knows about KTR.
 * Read-only. Optional: every method returns null when KTR is missing,
 * disabled, or an untested version, so callers just hide the numbers.
 * Rules: see CLAUDE.md → Working rules → Keep the Rhythm.
 */
import { App, moment, normalizePath } from "obsidian";

const ID = "keep-the-rhythm";
export const KTR_TESTED_VERSIONS = ["0.2.16"];
const TESTED_SCHEMA = "0.2";

export interface Activity {
  date: string; // YYYY-MM-DD
  filePath: string;
  changes?: { w?: number }[];
}
export interface KtrData {
  schema?: string;
  settings?: { startOfTheWeek?: string };
  stats?: { currentStreak?: number; highestStreak?: number; dailyActivity?: Activity[] };
}

export interface KtrStatus {
  ok: boolean;
  message: string;
}

interface PluginsApi {
  enabledPlugins?: Set<string>;
  manifests?: Record<string, { version: string }>;
}

export class KeepTheRhythm {
  private cache: { mtime: number; data: KtrData } | null = null;

  constructor(private app: App) {}

  status(): KtrStatus {
    const plugins = (this.app as unknown as { plugins?: PluginsApi }).plugins;
    if (!plugins?.enabledPlugins?.has(ID)) return { ok: false, message: "Keep the Rhythm is not installed or not enabled." };
    const v = plugins.manifests?.[ID]?.version ?? "?";
    if (!KTR_TESTED_VERSIONS.includes(v)) {
      return {
        ok: false,
        message: `Keep the Rhythm ${v} hasn't been tested with Inkwell (tested: ${KTR_TESTED_VERSIONS.join(", ")}). Word stats are hidden until it is.`,
      };
    }
    return { ok: true, message: `Keep the Rhythm ${v} — connected.` };
  }

  private async data(): Promise<KtrData | null> {
    if (!this.status().ok) return null;
    const path = normalizePath(`${this.app.vault.configDir}/plugins/${ID}/data.json`);
    try {
      const stat = await this.app.vault.adapter.stat(path);
      if (!stat) return null;
      if (this.cache?.mtime !== stat.mtime) {
        this.cache = { mtime: stat.mtime, data: JSON.parse(await this.app.vault.adapter.read(path)) as KtrData };
      }
      return usableData(this.cache.data);
    } catch (e) {
      console.warn("Inkwell: could not read Keep the Rhythm data", e);
      return null;
    }
  }

  /** First day of the current week, per KTR's own setting. */
  async weekStart(): Promise<string> {
    return weekStartFor(moment(), (await this.data())?.settings?.startOfTheWeek);
  }

  /** Net words per day (YYYY-MM-DD → words) in matching files between two dates (inclusive). Null if unavailable. */
  async dailyWords(
    match: (path: string) => boolean,
    from: string,
    to = moment().format("YYYY-MM-DD")
  ): Promise<Map<string, number> | null> {
    const d = await this.data();
    return d ? dailyWordsIn(d, match, from, to) : null;
  }

  /** Net words written in matching files between two dates (inclusive). Null if unavailable. */
  async words(match: (path: string) => boolean, from: string, to = moment().format("YYYY-MM-DD")): Promise<number | null> {
    const days = await this.dailyWords(match, from, to);
    if (!days) return null;
    let total = 0;
    for (const n of days.values()) total += n;
    return total;
  }

  async wordsThisWeek(match: (path: string) => boolean): Promise<number | null> {
    if (!this.status().ok) return null;
    return this.words(match, await this.weekStart());
  }

  async streak(): Promise<{ current: number; highest: number } | null> {
    const d = await this.data();
    return d ? streakIn(d) : null;
  }

  /** Markdown for KTR's own heatmap block, filtered by a KTR filter expression. */
  heatmapBlock(filter: string, weeks = 12): string {
    return ["```ktr-heatmap", filter, "", "OPTIONS", `WEEKS ${weeks}`, "```"].join("\n");
  }
}

/** KTR filter string literal. */
export function ktrString(s: string): string {
  return JSON.stringify(s);
}

// ---------- Pure readers of KTR's data file (tested in tests/keep-the-rhythm.test.ts) ----------

/** KTR's data, if it has the schema Inkwell was tested against; otherwise null (stats stay hidden). */
export function usableData(raw: unknown): KtrData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as KtrData;
  if (d.schema !== TESTED_SCHEMA || !Array.isArray(d.stats?.dailyActivity)) return null;
  return d;
}

const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/** The first day (YYYY-MM-DD) of the week containing `today`, for KTR's `startOfTheWeek` (Monday if unknown). */
export function weekStartFor(today: moment.Moment, startOfTheWeek: string | undefined): string {
  const startIdx = Math.max(0, WEEKDAYS.indexOf(startOfTheWeek ?? "MONDAY"));
  const back = (today.day() - startIdx + 7) % 7;
  return today.clone().subtract(back, "days").format("YYYY-MM-DD");
}

/** Net words per day in matching files between two dates (inclusive). Days with no activity are absent. */
export function dailyWordsIn(d: KtrData, match: (path: string) => boolean, from: string, to: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of d.stats?.dailyActivity ?? []) {
    if (typeof a?.date !== "string" || typeof a.filePath !== "string") continue;
    if (a.date < from || a.date > to || !match(a.filePath)) continue;
    let n = 0;
    for (const c of a.changes ?? []) n += Number(c?.w) || 0;
    out.set(a.date, (out.get(a.date) ?? 0) + n);
  }
  return out;
}

export function streakIn(d: KtrData): { current: number; highest: number } {
  return { current: Number(d.stats?.currentStreak) || 0, highest: Number(d.stats?.highestStreak) || 0 };
}
