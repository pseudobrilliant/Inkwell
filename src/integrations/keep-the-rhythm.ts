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

interface Activity {
  date: string; // YYYY-MM-DD
  filePath: string;
  changes?: { w?: number }[];
}
interface KtrData {
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
        this.cache = { mtime: stat.mtime, data: JSON.parse(await this.app.vault.adapter.read(path)) };
      }
      const d = this.cache.data;
      if (d.schema !== TESTED_SCHEMA || !Array.isArray(d.stats?.dailyActivity)) return null;
      return d;
    } catch (e) {
      console.warn("Inkwell: could not read Keep the Rhythm data", e);
      return null;
    }
  }

  /** First day of the current week, per KTR's own setting. */
  async weekStart(): Promise<string> {
    const d = await this.data();
    const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const startIdx = Math.max(0, days.indexOf(d?.settings?.startOfTheWeek ?? "MONDAY"));
    const today = moment();
    const back = (today.day() - startIdx + 7) % 7;
    return today.clone().subtract(back, "days").format("YYYY-MM-DD");
  }

  /** Net words per day (YYYY-MM-DD → words) in matching files between two dates (inclusive). Null if unavailable. */
  async dailyWords(
    match: (path: string) => boolean,
    from: string,
    to = moment().format("YYYY-MM-DD")
  ): Promise<Map<string, number> | null> {
    const d = await this.data();
    if (!d) return null;
    const out = new Map<string, number>();
    for (const a of d.stats?.dailyActivity ?? []) {
      if (a.date < from || a.date > to || !match(a.filePath)) continue;
      let n = 0;
      for (const c of a.changes ?? []) n += Number(c.w) || 0;
      out.set(a.date, (out.get(a.date) ?? 0) + n);
    }
    return out;
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
    if (!d) return null;
    return { current: Number(d.stats?.currentStreak) || 0, highest: Number(d.stats?.highestStreak) || 0 };
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
