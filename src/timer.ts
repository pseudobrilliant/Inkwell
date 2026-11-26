/**
 * Writing timer (session/day level). One timer at a time.
 *
 * Creating or opening an exercise (including from a random prompt or a drill) or opening
 * today's journal arms the timer for that note. It starts on the first keystroke in the note, pauses
 * by itself after a stretch without typing, and resumes when you type again.
 * Stopping it adds the minutes to the note's `writing_min`.
 *
 * An exercise with a writing block is timed by block: only drafting in a block counts, the timer lives in the
 * block's toolbar instead of the note's header, and the block's first review stops it and logs the minutes.
 *
 * Time is kept as timestamps, not a ticking counter, so it stays right when a phone
 * puts Obsidian in the background and survives a reload.
 */
import { MarkdownView, Menu, Notice, TFile, setIcon, type Editor } from "obsidian";
import type InkwellPlugin from "./main";
import { fmOf, fmStr, type Frontmatter } from "./util";
import * as T from "./timerstate";
import type { TimerState, Timing } from "./timerstate";
import type { BlockTool } from "./writingblocktoolbar";
import { drafting, type WritingBlock } from "./writingblocks";

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
  /** How each note seen so far is timed (by block or as a whole note). In memory only: never stored (ADR 0003). */
  private timings = new Map<string, Timing>();
  /** The timer's elements in block toolbars; the tick updates them, and drops those no longer on the page. */
  private tools = new Set<HTMLElement>();

  /** The timer as a block toolbar tool, for the host to register. */
  readonly tool: BlockTool = { id: "timer", render: (el, ctx) => this.renderTool(el, ctx.sourcePath, ctx.block) };

  constructor(private plugin: InkwellPlugin) {
    const { app } = plugin;
    this.statusEl = plugin.addStatusBarItem();
    this.statusEl.addClass("mod-clickable", "inkwell-timer-status");
    this.statusEl.onClickEvent((evt) => this.menu().showAtMouseEvent(evt));

    const stored: unknown = app.loadLocalStorage(TIMER_STORAGE_KEY);
    this.current = T.isTimerState(stored) ? T.restore(stored) : null;
    this.persist();

    plugin.registerEvent(app.workspace.on("editor-change", (editor, info) => this.onType(editor, info.file)));
    // Opening an exercise gets the timer ready for it, like the journal: never replaces a timer in use.
    plugin.registerEvent(
      app.workspace.on("file-open", (file) => {
        const fm = fmOf(app, file);
        if (file && fmStr(fm?.type) === "exercise") void this.armOnOpen(file, Number(fm?.minutes) || 0);
      })
    );
    plugin.registerEvent(app.workspace.on("layout-change", () => this.render()));
    plugin.registerEvent(app.workspace.on("active-leaf-change", () => this.render()));
    plugin.registerEvent(
      app.vault.on("rename", (f, old) => {
        const how = this.timings.get(old);
        if (how) this.timings.set(f.path, how);
        this.timings.delete(old);
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
      for (const el of this.tools) el.empty();
      this.tools.clear();
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

  /** How a note is timed, from its type and its text. */
  private timingOf(file: TFile, text: string): Timing {
    const how = T.timing(fmStr(fmOf(this.plugin.app, file)?.type), text);
    this.timings.set(file.path, how);
    return how;
  }

  /** Opening an exercise arms it, unless it has blocks and every one has been reviewed: nothing is left to draft. */
  private async armOnOpen(file: TFile, goalMin: number): Promise<void> {
    const text = await this.plugin.app.vault.cachedRead(file);
    if (this.timingOf(file, text) === "block" && !T.hasDraftLeft(text)) {
      this.render();
      return;
    }
    await this.arm(file, goalMin, false);
  }

  private onType(editor: Editor, file: TFile | null) {
    const s = this.state;
    if (!s || !file || file.path !== s.path) return;
    const text = editor.getValue();
    const before = this.timings.get(file.path);
    const how = this.timingOf(file, text);
    if (how !== before) this.render();
    if (!T.countsAsTyping(how, text, editor.posToOffset(editor.getCursor()))) return;
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

  /**
   * A block in `path` was reviewed for the first time, leaving the note as `text`. If the timer is on that note, stop
   * and log; then, if another block is still in Draft, arm it again with the same goal. This re-arm ignores "Time
   * practice writing": the writer was already timing this note.
   */
  async blockReviewed(path: string, text: string): Promise<void> {
    const file = this.plugin.app.vault.getFileByPath(path);
    if (file) this.timingOf(file, text);
    const r = T.afterFirstReview(this.state, path, text);
    if (!r.log) return;
    await this.stop();
    if (r.rearmGoal !== null) this.state = T.armed(path, r.rearmGoal);
  }

  /** A timer for this note that runs right away (the command, or "Start now" in a block's toolbar). */
  private startFor(file: TFile) {
    const fm = fmOf(this.plugin.app, file);
    const goal = fmStr(fm?.type) === "exercise" ? Number(fm?.minutes) || 0 : this.plugin.settings.journalMinutes;
    this.state = T.start(T.armed(file.path, goal), Date.now());
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

  /** Status bar on desktop; a header button on the timed note, or in its blocks' toolbars if it's timed by block. */
  private render() {
    this.renderTools();
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
      if (!(view instanceof MarkdownView) || !s || !view.file || view.file.path !== s.path) continue;
      // Timed by block: the block's toolbar carries the timer instead.
      if ((this.timings.get(s.path) ?? this.timingOf(view.file, view.getViewData())) === "block") continue;
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

  /**
   * The timer in a block's toolbar: only in exercises, on blocks still being drafted. It shows this note's timer (time,
   * and a ring toward the goal), nothing while another note has the timer, and a quiet icon that offers to start one
   * when there's no timer. A tap opens the menu.
   */
  private renderTool(el: HTMLElement, path: string, block: WritingBlock) {
    const file = this.plugin.app.vault.getFileByPath(path);
    if (!file || !drafting(block) || fmStr(fmOf(this.plugin.app, file)?.type) !== "exercise") return;
    el.dataset.path = path;
    const button = el.createEl("button", { cls: "inkwell-timer-tool" });
    const ring = button.createSvg("svg", { cls: "inkwell-timer-ring", attr: { viewBox: "0 0 20 20", "aria-hidden": "true" } });
    ring.createSvg("circle", { cls: "inkwell-timer-ring-track", attr: { cx: 10, cy: 10, r: 8, pathLength: 100 } });
    ring.createSvg("circle", {
      cls: "inkwell-timer-ring-arc",
      attr: { cx: 10, cy: 10, r: 8, pathLength: 100, "stroke-dasharray": 100, "stroke-dashoffset": 100, transform: "rotate(-90 10 10)" },
    });
    setIcon(button.createSpan({ cls: "inkwell-timer-tool-icon" }), "timer");
    button.createSpan({ cls: "inkwell-timer-time" });
    // Like the modes: a tap on the toolbar isn't a tap in the writing, so the cursor stays put.
    button.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.menu(file).showAtMouseEvent(e);
    });
    this.tools.add(el);
    this.updateTool(el);
  }

  private renderTools() {
    for (const el of this.tools) {
      if (el.isConnected) this.updateTool(el);
      else this.tools.delete(el);
    }
  }

  private updateTool(el: HTMLElement) {
    const s = this.state;
    const mine = !!s && s.path === el.dataset.path;
    el.toggleClass("is-hidden", !!s && !mine);
    const button = el.find(".inkwell-timer-tool");
    if (!button) return;
    const progress = mine ? T.goalProgress(s, Date.now()) : null;
    button.find(".inkwell-timer-ring")?.toggleClass("is-hidden", progress === null);
    button.find(".inkwell-timer-tool-icon")?.toggleClass("is-hidden", progress !== null);
    button.find(".inkwell-timer-ring-arc")?.setAttr("stroke-dashoffset", String(100 - (progress ?? 0) * 100));
    button.find(".inkwell-timer-time")?.setText(mine ? T.clock(T.elapsed(s, Date.now())) : "");
    button.toggleClass("is-paused", mine && s.phase !== "running");
    button.setAttr("aria-label", mine ? this.tooltip() : "Start writing timer");
  }

  /** The timer's menu. From a block's toolbar with no timer yet (`from`), it offers only to start one for that note. */
  private menu(from?: TFile): Menu {
    const s = this.state;
    const menu = new Menu();
    if (!s) {
      if (from) menu.addItem((i) => i.setTitle("Start now").setIcon("play").onClick(() => this.startFor(from)));
      return menu;
    }
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
        if (!this.state && active) this.startFor(active);
        else this.toggle();
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
