/**
 * The word log in the vault (spec word-log; ADR 0008). Each device writes only its own folder,
 * `<folders.wordLog>/<device>/`, one note per month, and reads every device's. The format and the sums are pure, in
 * src/wordlog.ts. Every word number Inkwell shows comes through `WordLog`, reached as `plugin.words`.
 */
import { moment, normalizePath, Platform, TFile, type App } from "obsidian";
import type InkwellPlugin from "./main";
import { modeMatchers } from "./contribution";
import { ensureFolder } from "./util";
import { addToLog, dailyWordsIn, newLogFile, parseLog, renameInLog, streakIn, sumDays, weekStartFor, type LogRow, type Streak } from "./wordlog";

const DAY = "YYYY-MM-DD";
/** This device's id, kept in local storage (ADR 0003), never in the synced settings. */
export const DEVICE_KEY = "inkwell-word-log-device";
/** At most this long between a word being typed and it being written to the log. */
export const FLUSH_MS = 10_000;

/** This device's id, made the first time it's asked for: its kind and four random hex digits (`desktop-3f9a`). */
export function deviceId(app: Pick<App, "loadLocalStorage" | "saveLocalStorage">): string {
  const saved: unknown = app.loadLocalStorage(DEVICE_KEY);
  if (typeof saved === "string" && /^[\w-]+$/.test(saved)) return saved;
  const hex = Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  const id = `${Platform.isMobile ? "mobile" : "desktop"}-${hex}`;
  app.saveLocalStorage(DEVICE_KEY, id);
  return id;
}

const key = (date: string, path: string) => `${date}\u0000${path}`;

export interface StoreOptions {
  /** How a flush is put off; tests pass their own. */
  schedule?: (fn: () => void, ms: number) => void;
}

/**
 * Words written on this device, held in memory and added to this device's month notes at most every 10 seconds,
 * and on `flush()`. Reads add up every device's notes, each cached until its `mtime` changes.
 */
export class WordLogStore {
  private buffer = new Map<string, LogRow>();
  private cache = new Map<string, { mtime: number; rows: LogRow[] }>();
  private scheduled = false;
  private writing: Promise<void> = Promise.resolve();
  private schedule: (fn: () => void, ms: number) => void;

  constructor(
    private app: App,
    private folder: () => string,
    readonly device: string,
    opts: StoreOptions = {}
  ) {
    this.schedule = opts.schedule ?? ((fn, ms) => window.setTimeout(fn, ms));
  }

  private root(): string {
    return normalizePath(this.folder());
  }

  /** Whether a path is in the word log folder (any device's). */
  inLog(path: string): boolean {
    return path.startsWith(this.root() + "/");
  }

  private ownFolder(): string {
    return `${this.root()}/${this.device}`;
  }

  /** Log `words` (net, can be negative) for a note on a day, today by default. */
  add(path: string, words: number, date = moment().format(DAY)): void {
    if (!words || this.inLog(path)) return;
    const k = key(date, path);
    const row = this.buffer.get(k);
    if (row) row.words += words;
    else this.buffer.set(k, { date, path, words });
    if (!this.scheduled) {
      this.scheduled = true;
      this.schedule(() => {
        this.scheduled = false;
        void this.flush();
      }, FLUSH_MS);
    }
  }

  /** Write what's buffered to this device's month notes. Flushes run one at a time. */
  flush(): Promise<void> {
    this.writing = this.writing.then(() => this.write()).catch((e) => console.error("Inkwell: could not write the word log", e));
    return this.writing;
  }

  private async write(): Promise<void> {
    if (!this.buffer.size) return;
    const rows = [...this.buffer.values()].filter((r) => r.words !== 0);
    this.buffer.clear();
    const byMonth = new Map<string, LogRow[]>();
    for (const r of rows) {
      const month = r.date.slice(0, 7);
      byMonth.set(month, [...(byMonth.get(month) ?? []), r]);
    }
    for (const [month, add] of byMonth) {
      try {
        const file = await this.monthFile(month);
        await this.app.vault.process(file, (text) => addToLog(text, add));
      } catch (e) {
        // Keep the words for the next flush rather than lose them.
        for (const r of add) {
          const k = key(r.date, r.path);
          const row = this.buffer.get(k);
          if (row) row.words += r.words;
          else this.buffer.set(k, { ...r });
        }
        throw e;
      }
    }
  }

  private async monthFile(month: string): Promise<TFile> {
    const path = `${this.ownFolder()}/${month}.md`;
    const existing = this.app.vault.getFileByPath(path);
    if (existing) return existing;
    await ensureFolder(this.app, this.ownFolder());
    return this.app.vault.create(path, newLogFile(this.device, month));
  }

  /** Every device's log notes. */
  private logFiles(): TFile[] {
    return this.app.vault.getMarkdownFiles().filter((f) => this.inLog(f.path));
  }

  /** Every readable row, from every device, plus what this device hasn't written yet. */
  async rows(): Promise<LogRow[]> {
    const out: LogRow[] = [];
    const seen = new Set<string>();
    for (const f of this.logFiles()) {
      seen.add(f.path);
      let c = this.cache.get(f.path);
      if (c?.mtime !== f.stat.mtime) {
        c = { mtime: f.stat.mtime, rows: parseLog(await this.app.vault.cachedRead(f)) };
        this.cache.set(f.path, c);
      }
      out.push(...c.rows);
    }
    for (const p of [...this.cache.keys()]) if (!seen.has(p)) this.cache.delete(p);
    out.push(...this.buffer.values());
    return out;
  }

  /** Drop a log note from the cache (it changed or went). */
  forget(path: string): void {
    this.cache.delete(path);
  }

  /** A note or folder was renamed: rewrite its path in this device's notes only, and in what's buffered. */
  async rename(oldPath: string, newPath: string): Promise<void> {
    if (this.inLog(oldPath) || this.inLog(newPath)) return;
    const moved = (p: string) => (p === oldPath ? newPath : p.startsWith(oldPath + "/") ? newPath + p.slice(oldPath.length) : null);
    for (const [k, r] of [...this.buffer]) {
      const to = moved(r.path);
      if (to === null) continue;
      this.buffer.delete(k);
      const nk = key(r.date, to);
      const row = this.buffer.get(nk);
      if (row) row.words += r.words;
      else this.buffer.set(nk, { ...r, path: to });
    }
    const own = this.ownFolder() + "/";
    for (const f of this.logFiles()) {
      if (!f.path.startsWith(own)) continue;
      const text = await this.app.vault.cachedRead(f);
      if (renameInLog(text, oldPath, newPath) === text) continue;
      await this.app.vault.process(f, (t) => renameInLog(t, oldPath, newPath));
    }
  }
}

/**
 * Inkwell's word numbers, all from the log (`plugin.words`). Never null: with nothing logged, the numbers are zero.
 * `match` picks notes by path; `modeMatchers` (src/contribution.ts) has the ones for each mode.
 */
export class WordLog {
  readonly store: WordLogStore;

  constructor(
    private plugin: InkwellPlugin,
    opts: StoreOptions = {}
  ) {
    this.store = new WordLogStore(plugin.app, () => plugin.settings.folders.wordLog, deviceId(plugin.app), opts);
  }

  /** Watch the vault: renames rewrite this device's paths, and changed log notes are read again. Flush on unload and when the app is hidden. */
  register(): void {
    const { plugin, store } = this;
    const { vault } = plugin.app;
    plugin.registerEvent(vault.on("rename", (f, old) => void store.rename(old, f.path)));
    plugin.registerEvent(vault.on("modify", (f) => store.inLog(f.path) && store.forget(f.path)));
    plugin.registerEvent(vault.on("delete", (f) => store.inLog(f.path) && store.forget(f.path)));
    plugin.register(() => void store.flush());
    plugin.registerDomEvent(activeDocument, "visibilitychange", () => {
      if (activeDocument.visibilityState === "hidden") void store.flush();
    });
  }

  /** Log words the writer typed in a note's writing blocks. */
  add(path: string, words: number): void {
    this.store.add(path, words);
  }

  /** The first day (YYYY-MM-DD) of this week, from the "Week starts on" setting. */
  weekStart(): string {
    return weekStartFor(moment(), this.plugin.settings.weekStart);
  }

  /** Net words per day (YYYY-MM-DD → words) in matching notes between two dates, inclusive. */
  async dailyWords(match: (path: string) => boolean, from: string, to = moment().format(DAY)): Promise<Map<string, number>> {
    return dailyWordsIn(await this.store.rows(), match, from, to);
  }

  /** Net words in matching notes between two dates, inclusive. */
  async words(match: (path: string) => boolean, from: string, to = moment().format(DAY)): Promise<number> {
    return sumDays(await this.dailyWords(match, from, to));
  }

  async wordsThisWeek(match: (path: string) => boolean): Promise<number> {
    return this.words(match, this.weekStart());
  }

  /** All-writing words per day, ever. */
  async allDays(): Promise<Map<string, number>> {
    return this.dailyWords(modeMatchers(this.plugin).all, "0000-00-00");
  }

  /** Days showed up in a row (current and longest), across all writing. */
  async streak(): Promise<Streak> {
    return streakIn(await this.allDays(), moment().format(DAY));
  }
}
