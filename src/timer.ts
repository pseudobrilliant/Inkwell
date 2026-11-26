/**
 * Writing timer (session/day level). One timer at a time.
 *
 * Creating or opening an exercise (including from a random prompt or a drill) or opening
 * today's journal arms the timer for that note. It starts on the first keystroke in the note, pauses
 * by itself after a stretch without typing, and resumes when you type again.
 * Stopping it adds the minutes to the note's `writing_min`.
 *
 * Time is kept as timestamps, not a ticking counter, so it stays right when a phone
 * puts Obsidian in the background and survives a reload.
 */
import { MarkdownView, Menu, Notice, TFile } from "obsidian";
import type InkwellPlugin from "./main";
import { fmOf, fmStr, type Frontmatter } from "./util";
import * as T from "./timerstate";
import type { TimerState } from "./timerstate";

export type { TimerState } from "./timerstate";

/** Device-local storage key for the running timer: each device times its own writing, and it never syncs. */
export const TIMER_STORAGE_KEY = "inkwell-timer";

/** Notes the timer can run on: exercises and journal entries. */
export function isTimedNote(plugin: InkwellPlugin, file: TFile | null): file is TFile {
  const type = fmStr(fmOf(plugin.app, file)?.type);
  return type === "exercise" || type === "journal";
}

export class WritingTimer {
  private statusEl: HTMLElement;
  private actions = new Map<MarkdownView, HTMLElement>();
  private current: TimerState | null;

  constructor(private plugin: InkwellPlugin) {
    const { app } = plugin;
    this.statusEl = plugin.addStatusBarItem();
    this.statusEl.addClass("mod-clickable", "inkwell-timer-status");
    this.statusEl.onClickEvent((evt) => this.menu().showAtMouseEvent(evt));

    const stored: unknown = app.loadLocalStorage(TIMER_STORAGE_KEY);
    this.current = T.isTimerState(stored) ? T.restore(stored) : null;
    this.persist();

    plugin.registerEvent(app.workspace.on("editor-change", (_editor, info) => this.onType(info.file)));
    // Opening an exercise gets the timer ready for it, like the journal: never replaces a timer in use.
    plugin.registerEvent(
      app.workspace.on("file-open", (file) => {
        const fm = fmOf(app, file);
        if (file && fmStr(fm?.type) === "exercise") void this.arm(file, Number(fm?.minutes) || 0, false);
      })
    );
    plugin.registerEvent(app.workspace.on("layout-change", () => this.render()));
    plugin.registerEvent(app.workspace.on("active-leaf-change", () => this.render()));
    plugin.registerEvent(
      app.vault.on("rename", (f, old) => {
        if (this.state?.path !== old) return;
        this.state = { ...this.state, path: f.path };
      })
    );
    plugin.registerEvent(
      app.vault.on("delete", (f) => {
        if (this.state?.path !== f.path) return;
        this.state = null;
        new Notice("Writing timer discarded: its note was deleted.");
      })
    );
    plugin.registerInterval(window.setInterval(() => this.tick(), 1000));
    plugin.register(() => {
      for (const el of this.actions.values()) el.remove();
      this.actions.clear();
    });
    this.addCommands();
    app.workspace.onLayoutReady(() => this.render());
  }

  /** A timer from an older version, kept in the synced settings file: adopt it unless this device has one. */
  adoptLegacy(s: unknown) {
    if (this.current || !T.isTimerState(s)) return;
    this.state = T.restore(s);
  }

  private get state(): TimerState | null {
    return this.current;
  }

  /** Every change is saved to device-local storage (synchronous and cheap) and shown. */
  private set state(s: TimerState | null) {
    this.current = s;
    this.persist();
    this.render();
  }

  private persist() {
    this.plugin.app.saveLocalStorage(TIMER_STORAGE_KEY, this.current);
  }

  /**
   * Get the timer ready for a note; it starts on the first keystroke there.
   * `replace`: if another note's timer has time on it, log it first (new exercise).
   * Otherwise a timer already in use is left alone (opening the journal mid-exercise).
   */
  async arm(file: TFile, goalMin: number, replace: boolean): Promise<void> {
    if (!this.plugin.settings.timerAutoStart) return;
    const s = this.state;
    if (s?.path === file.path) return;
    if (s && s.phase !== "armed") {
      if (!replace) return;
      await this.stop();
    }
    this.state = T.armed(file.path, goalMin);
  }

  private onType(file: TFile | null) {
    const s = this.state;
    if (!s || file?.path !== s.path) return;
    const next = T.typed(s, Date.now());
    if (next.phase !== s.phase) this.state = next;
    else {
      // Only the last keystroke changed: keep it without redrawing on every key.
      this.current = next;
      this.persist();
    }
  }

  toggle() {
    if (this.state) this.state = T.toggle(this.state, Date.now());
  }

  /** Back to zero; starts again on the next keystroke. */
  reset() {
    if (this.state) this.state = T.reset(this.state);
  }

  /** Stop and add the whole minutes to the note's `writing_min`. */
  async stop(): Promise<void> {
    const s = this.state;
    if (!s) return;
    const minutes = T.minutesToLog(s, Date.now());
    this.state = null;
    const file = this.plugin.app.vault.getFileByPath(s.path);
    if (!file) return;
    if (minutes < 1) {
      new Notice("Writing timer stopped. Under a minute, so nothing was logged.");
      return;
    }
    await this.plugin.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
      fm.writing_min = (Number(fm.writing_min) || 0) + minutes;
    });
    new Notice(`Logged ${minutes} ${minutes === 1 ? "minute" : "minutes"} to ${file.basename}.`);
  }

  private clear() {
    this.state = null;
  }

  private tick() {
    const s = this.state;
    if (!s) return;
    const r = T.tick(s, Date.now(), this.plugin.settings.timerIdleMinutes * 60_000);
    if (r.state !== s) this.state = r.state;
    else if (s.phase === "running") this.render();
    if (r.goalReached) new Notice(`Time's up: ${s.goalMin} minutes. Keep writing, or stop the timer to log it.`, 10_000);
  }

  private label(): string {
    const s = this.state;
    if (!s) return "";
    if (s.phase === "armed") return s.goalMin ? `Ready · ${s.goalMin} min` : "Ready";
    const goal = s.goalMin ? ` / ${T.clock(s.goalMin * 60_000)}` : "";
    return `${T.clock(T.elapsed(s, Date.now()))}${goal}`;
  }

  private tooltip(): string {
    const s = this.state;
    if (!s) return "";
    const name = this.plugin.app.vault.getFileByPath(s.path)?.basename ?? s.path;
    const what =
      s.phase === "armed" ? "starts when you type" : s.phase === "running" ? "running" : s.pausedBy === "idle" ? "paused, resumes when you type" : "paused";
    return `Writing timer · ${name} · ${what}`;
  }

  /** Status bar on desktop; a header button on the timed note (the only place it shows on mobile). */
  private render() {
    const s = this.state;
    const icon = !s ? "" : s.phase === "running" ? "⏱" : s.phase === "paused" ? "⏸" : "⏲";
    if (s) {
      this.statusEl.setText(`${icon} ${this.label()}`);
      this.statusEl.setAttr("aria-label", this.tooltip());
      this.statusEl.toggleClass("is-paused", s.phase !== "running");
      this.statusEl.show();
    } else {
      this.statusEl.hide();
    }

    const seen = new Set<MarkdownView>();
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || !s || view.file?.path !== s.path) continue;
      seen.add(view);
      let el = this.actions.get(view);
      if (!el) {
        el = view.addAction("timer", "Writing timer", (evt) => this.menu().showAtMouseEvent(evt));
        el.addClass("inkwell-timer-action");
        el.createSpan({ cls: "inkwell-timer-time" });
        this.actions.set(view, el);
      }
      el.find(".inkwell-timer-time")?.setText(s.phase === "armed" ? "" : this.label());
      el.setAttr("aria-label", this.tooltip());
      el.toggleClass("is-paused", s.phase !== "running");
    }
    for (const [view, el] of this.actions) {
      if (seen.has(view)) continue;
      el.remove();
      this.actions.delete(view);
    }
  }

  private menu(): Menu {
    const s = this.state;
    const menu = new Menu();
    if (!s) return menu;
    const startLabel = s.phase === "armed" ? "Start now" : s.phase === "running" ? "Pause" : "Resume";
    menu.addItem((i) => i.setTitle(startLabel).setIcon(s.phase === "running" ? "pause" : "play").onClick(() => this.toggle()));
    menu.addItem((i) => i.setTitle("Reset").setIcon("rotate-ccw").onClick(() => this.reset()));
    menu.addItem((i) => i.setTitle("Stop and log minutes").setIcon("square").onClick(() => void this.stop()));
    menu.addSeparator();
    menu.addItem((i) => i.setTitle("Open timed note").setIcon("file-text").onClick(() => this.openNote()));
    menu.addItem((i) => i.setTitle("Discard timer").setIcon("trash-2").onClick(() => this.clear()));
    return menu;
  }

  private openNote() {
    const file = this.state && this.plugin.app.vault.getFileByPath(this.state.path);
    if (file) void this.plugin.app.workspace.getLeaf(false).openFile(file);
  }

  private addCommands() {
    const { plugin } = this;
    plugin.addCommand({
      id: "timer-toggle",
      name: "Start or pause writing timer",
      checkCallback: (checking) => {
        const active = plugin.app.workspace.getActiveFile();
        if (!this.state && !isTimedNote(plugin, active)) return false;
        if (checking) return true;
        if (!this.state && active) {
          const fm = fmOf(plugin.app, active);
          const goal = fmStr(fm?.type) === "exercise" ? Number(fm?.minutes) || 0 : plugin.settings.journalMinutes;
          this.current = T.armed(active.path, goal);
        }
        this.toggle();
        return true;
      },
    });
    const whenTimer = (id: string, name: string, fn: () => unknown) =>
      plugin.addCommand({
        id,
        name,
        checkCallback: (checking) => {
          if (!this.state) return false;
          if (!checking) void fn();
          return true;
        },
      });
    whenTimer("timer-reset", "Reset writing timer", () => this.reset());
    whenTimer("timer-stop", "Stop writing timer and log minutes", () => this.stop());
    whenTimer("timer-discard", "Discard writing timer", () => this.clear());
  }
}
