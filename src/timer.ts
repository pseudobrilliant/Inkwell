/**
 * Writing timer (session/day level). One timer at a time.
 *
 * Creating an exercise (including from a random prompt) or opening today's journal
 * arms the timer for that note. It starts on the first keystroke in the note, pauses
 * by itself after a stretch without typing, and resumes when you type again.
 * Stopping it adds the minutes to the note's `writing_min`.
 *
 * Time is kept as timestamps, not a ticking counter, so it stays right when a phone
 * puts Obsidian in the background and survives a reload.
 */
import { MarkdownView, Menu, Notice, TFile, debounce } from "obsidian";
import type InkwellPlugin from "./main";
import { fmOf, fmStr, type Frontmatter } from "./util";

export interface TimerState {
  path: string;
  /** Goal in minutes; 0 = no goal. */
  goalMin: number;
  /** armed = waiting for the first keystroke. */
  phase: "armed" | "running" | "paused";
  /** Typing resumes an idle pause, but not one you chose. */
  pausedBy?: "idle" | "user";
  /** When the current running stretch began (ms). */
  startedAt: number | null;
  /** Time counted before the current running stretch (ms). */
  elapsedMs: number;
  lastTypedAt: number;
  goalNotified: boolean;
}

/** m:ss, or h:mm:ss past an hour. */
function clock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Notes the timer can run on: exercises and journal entries. */
export function isTimedNote(plugin: InkwellPlugin, file: TFile | null): file is TFile {
  const type = fmStr(fmOf(plugin.app, file)?.type);
  return type === "exercise" || type === "journal";
}

export class WritingTimer {
  private statusEl: HTMLElement;
  private actions = new Map<MarkdownView, HTMLElement>();
  private saveSoon = debounce(() => void this.plugin.saveSettings(), 10_000, true);

  constructor(private plugin: InkwellPlugin) {
    const { app } = plugin;
    this.statusEl = plugin.addStatusBarItem();
    this.statusEl.addClass("mod-clickable", "inkwell-timer-status");
    this.statusEl.onClickEvent((evt) => this.menu().showAtMouseEvent(evt));

    // A timer left running when Obsidian closed counts only up to the last keystroke.
    const s = this.state;
    if (s?.phase === "running") this.pause("idle", s.lastTypedAt);

    plugin.registerEvent(app.workspace.on("editor-change", (_editor, info) => this.onType(info.file)));
    plugin.registerEvent(app.workspace.on("layout-change", () => this.render()));
    plugin.registerEvent(app.workspace.on("active-leaf-change", () => this.render()));
    plugin.registerEvent(
      app.vault.on("rename", (f, old) => {
        if (this.state?.path !== old) return;
        this.state.path = f.path;
        void plugin.saveSettings();
        this.render();
      })
    );
    plugin.registerEvent(
      app.vault.on("delete", (f) => {
        if (this.state?.path !== f.path) return;
        this.clear();
        new Notice("Writing timer discarded: its note was deleted.");
      })
    );
    plugin.registerInterval(window.setInterval(() => this.tick(), 1000));
    plugin.register(() => {
      this.saveSoon.cancel();
      for (const el of this.actions.values()) el.remove();
      this.actions.clear();
    });
    this.addCommands();
    app.workspace.onLayoutReady(() => this.render());
  }

  private get state(): TimerState | null {
    return this.plugin.settings.timer ?? null;
  }

  private set state(s: TimerState | null) {
    if (s) this.plugin.settings.timer = s;
    else delete this.plugin.settings.timer;
  }

  private elapsed(now = Date.now()): number {
    const s = this.state;
    if (!s) return 0;
    return s.elapsedMs + (s.phase === "running" && s.startedAt !== null ? now - s.startedAt : 0);
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
    this.state = {
      path: file.path,
      goalMin: Math.max(0, goalMin),
      phase: "armed",
      startedAt: null,
      elapsedMs: 0,
      lastTypedAt: 0,
      goalNotified: false,
    };
    await this.plugin.saveSettings();
    this.render();
  }

  private onType(file: TFile | null) {
    const s = this.state;
    if (!s || file?.path !== s.path) return;
    const now = Date.now();
    s.lastTypedAt = now;
    if (s.phase === "armed" || (s.phase === "paused" && s.pausedBy === "idle")) this.start(now);
    else this.saveSoon();
  }

  private start(now = Date.now()) {
    const s = this.state;
    if (!s || s.phase === "running") return;
    s.phase = "running";
    s.pausedBy = undefined;
    s.startedAt = now;
    s.lastTypedAt = now;
    void this.plugin.saveSettings();
    this.render();
  }

  /** Pause, counting time up to `at` (now, or the last keystroke for an idle pause). */
  private pause(by: "idle" | "user", at = Date.now()) {
    const s = this.state;
    if (!s || s.phase !== "running" || s.startedAt === null) return;
    s.elapsedMs += Math.max(0, at - s.startedAt);
    s.startedAt = null;
    s.phase = "paused";
    s.pausedBy = by;
    void this.plugin.saveSettings();
    this.render();
  }

  toggle() {
    const s = this.state;
    if (!s) return;
    if (s.phase === "running") this.pause("user");
    else this.start();
  }

  /** Back to zero; starts again on the next keystroke. */
  reset() {
    const s = this.state;
    if (!s) return;
    Object.assign(s, { phase: "armed", pausedBy: undefined, startedAt: null, elapsedMs: 0, goalNotified: false });
    void this.plugin.saveSettings();
    this.render();
  }

  /** Stop and add the whole minutes to the note's `writing_min`. */
  async stop(): Promise<void> {
    const s = this.state;
    if (!s) return;
    const minutes = Math.round(this.elapsed() / 60_000);
    this.clear();
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
    this.saveSoon.cancel();
    this.state = null;
    void this.plugin.saveSettings();
    this.render();
  }

  private tick() {
    const s = this.state;
    if (!s) return;
    const now = Date.now();
    const idleMs = this.plugin.settings.timerIdleMinutes * 60_000;
    if (s.phase === "running" && idleMs > 0 && now - s.lastTypedAt > idleMs) {
      this.pause("idle", s.lastTypedAt);
      return;
    }
    if (s.goalMin > 0 && !s.goalNotified && this.elapsed(now) >= s.goalMin * 60_000) {
      s.goalNotified = true;
      void this.plugin.saveSettings();
      new Notice(`Time's up: ${s.goalMin} minutes. Keep writing, or stop the timer to log it.`, 10_000);
    }
    if (s.phase === "running") this.render();
  }

  private label(): string {
    const s = this.state;
    if (!s) return "";
    if (s.phase === "armed") return s.goalMin ? `Ready · ${s.goalMin} min` : "Ready";
    const goal = s.goalMin ? ` / ${clock(s.goalMin * 60_000)}` : "";
    return `${clock(this.elapsed())}${goal}`;
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
          this.state = {
            path: active.path,
            goalMin: goal,
            phase: "armed",
            startedAt: null,
            elapsedMs: 0,
            lastTypedAt: 0,
            goalNotified: false,
          };
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
