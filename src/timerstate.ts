/**
 * The writing timer's state machine, kept free of Obsidian so it can be tested on its own.
 * Every function takes the time it should act at and returns a new state; nothing here reads the clock.
 * The UI, persistence and notices live in src/timer.ts.
 */
import { drafting, draftingAt, findBlocks } from "./writingblocks";

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

/** A timer ready for a note; it starts on the first keystroke there. */
export function armed(path: string, goalMin: number): TimerState {
  return {
    path,
    goalMin: Math.max(0, goalMin),
    phase: "armed",
    startedAt: null,
    elapsedMs: 0,
    lastTypedAt: 0,
    goalNotified: false,
  };
}

/** Time on the timer at `now` (ms). */
export function elapsed(s: TimerState, now: number): number {
  return s.elapsedMs + (s.phase === "running" && s.startedAt !== null ? Math.max(0, now - s.startedAt) : 0);
}

export function start(s: TimerState, now: number): TimerState {
  if (s.phase === "running") return s;
  return { ...s, phase: "running", pausedBy: undefined, startedAt: now, lastTypedAt: now };
}

/** Pause, counting time up to `at` (now, or the last keystroke for an idle pause). */
export function pause(s: TimerState, by: "idle" | "user", at: number): TimerState {
  if (s.phase !== "running" || s.startedAt === null) return s;
  return { ...s, elapsedMs: s.elapsedMs + Math.max(0, at - s.startedAt), startedAt: null, phase: "paused", pausedBy: by };
}

export function toggle(s: TimerState, now: number): TimerState {
  return s.phase === "running" ? pause(s, "user", now) : start(s, now);
}

/** Back to zero; starts again on the next keystroke. */
export function reset(s: TimerState): TimerState {
  return { ...s, phase: "armed", pausedBy: undefined, startedAt: null, elapsedMs: 0, goalNotified: false };
}

/** A keystroke in the timed note: starts an armed timer and resumes an idle pause, never a pause you chose. */
export function typed(s: TimerState, now: number): TimerState {
  const next = { ...s, lastTypedAt: now };
  if (s.phase === "armed" || (s.phase === "paused" && s.pausedBy === "idle")) return start(next, now);
  return next;
}

/** A timer left running when Obsidian closed counts only up to the last keystroke. */
export function restore(s: TimerState): TimerState {
  return s.phase === "running" ? pause(s, "idle", s.lastTypedAt) : s;
}

export interface TickResult {
  state: TimerState;
  /** The timer paused itself because nobody typed for `idleMs`. */
  idlePaused: boolean;
  /** The goal was reached on this tick (reported once per timer). */
  goalReached: boolean;
}

/** One tick of the clock. `idleMs` 0 = never pause by itself. */
export function tick(s: TimerState, now: number, idleMs: number): TickResult {
  if (s.phase === "running" && idleMs > 0 && now - s.lastTypedAt > idleMs) {
    return { state: pause(s, "idle", s.lastTypedAt), idlePaused: true, goalReached: false };
  }
  if (s.goalMin > 0 && !s.goalNotified && elapsed(s, now) >= s.goalMin * 60_000) {
    return { state: { ...s, goalNotified: true }, idlePaused: false, goalReached: true };
  }
  return { state: s, idlePaused: false, goalReached: false };
}

/** Whole minutes to log when the timer stops. */
export function minutesToLog(s: TimerState, now: number): number {
  return Math.round(elapsed(s, now) / 60_000);
}

/** m:ss, or h:mm:ss past an hour. */
export function clock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** A stored value that looks like a timer state (local storage can hold anything). */
export function isTimerState(v: unknown): v is TimerState {
  if (!v || typeof v !== "object") return false;
  const s = v as Partial<TimerState>;
  return (
    typeof s.path === "string" &&
    typeof s.goalMin === "number" &&
    (s.phase === "armed" || s.phase === "running" || s.phase === "paused") &&
    typeof s.elapsedMs === "number" &&
    typeof s.lastTypedAt === "number" &&
    (s.startedAt === null || typeof s.startedAt === "number")
  );
}

// ---------- Timing by block (exercises with a writing block) ----------

/**
 * How a note is timed. An exercise with a writing block is timed by block: only drafting counts. A journal, or an
 * exercise with no block, is timed as a whole note. Any other note gets no timer.
 */
export type Timing = "note" | "block" | "none";

export function timing(type: string, text: string): Timing {
  if (type === "exercise") return findBlocks(text).length ? "block" : "note";
  return type === "journal" ? "note" : "none";
}

/** Whether any block in the note is still being drafted (Draft mode, never reviewed). */
export function hasDraftLeft(text: string): boolean {
  return findBlocks(text).some(drafting);
}

/** Whether a keystroke at `pos` counts as typing for the timer. */
export function countsAsTyping(how: Timing, text: string, pos: number): boolean {
  return how === "note" || (how === "block" && draftingAt(text, pos));
}

/**
 * A block in note `path` was reviewed for the first time, leaving the note as `text`. If the timer is on that note it
 * stops and logs; it is then armed again with the same goal if another block is still being drafted.
 */
export function afterFirstReview(s: TimerState | null, path: string, text: string): { log: boolean; rearmGoal: number | null } {
  if (!s || s.path !== path) return { log: false, rearmGoal: null };
  return { log: true, rearmGoal: hasDraftLeft(text) ? s.goalMin : null };
}

/** Share of the goal written, from 0 to 1 (full at the goal and after); null with no goal. */
export function goalProgress(s: TimerState, now: number): number | null {
  if (s.goalMin <= 0) return null;
  return Math.min(1, elapsed(s, now) / (s.goalMin * 60_000));
}
