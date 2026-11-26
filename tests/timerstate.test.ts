import { describe, expect, it } from "vitest";
import * as T from "../src/timerstate";

const MIN = 60_000;
const t0 = 1_000_000;

describe("writing timer state", () => {
  it("starts armed with no time, and the first keystroke starts it", () => {
    const s = T.armed("Ex.md", 15);
    expect(s.phase).toBe("armed");
    expect(T.elapsed(s, t0)).toBe(0);
    const r = T.typed(s, t0);
    expect(r.phase).toBe("running");
    expect(T.elapsed(r, t0 + 2 * MIN)).toBe(2 * MIN);
  });

  it("never takes a negative goal", () => {
    expect(T.armed("Ex.md", -5).goalMin).toBe(0);
  });

  it("idle pause counts only up to the last keystroke", () => {
    let s = T.typed(T.armed("Ex.md", 0), t0);
    s = T.typed(s, t0 + 3 * MIN); // last keystroke at 3 min
    const r = T.tick(s, t0 + 9 * MIN, 5 * MIN); // 6 min of silence > 5 min idle
    expect(r.idlePaused).toBe(true);
    expect(r.state.phase).toBe("paused");
    expect(r.state.pausedBy).toBe("idle");
    expect(T.elapsed(r.state, t0 + 20 * MIN)).toBe(3 * MIN);
  });

  it("does not pause by itself when idle pausing is off", () => {
    const s = T.typed(T.armed("Ex.md", 0), t0);
    expect(T.tick(s, t0 + 60 * MIN, 0).idlePaused).toBe(false);
  });

  it("typing resumes an idle pause but not a pause you chose", () => {
    const running = T.typed(T.armed("Ex.md", 0), t0);
    const idle = T.tick(running, t0 + 10 * MIN, 5 * MIN).state;
    expect(T.typed(idle, t0 + 11 * MIN).phase).toBe("running");

    const user = T.toggle(running, t0 + MIN);
    expect(user.pausedBy).toBe("user");
    const stillPaused = T.typed(user, t0 + 2 * MIN);
    expect(stillPaused.phase).toBe("paused");
    expect(stillPaused.lastTypedAt).toBe(t0 + 2 * MIN);
  });

  it("adds up separate running stretches", () => {
    let s = T.typed(T.armed("Ex.md", 0), t0);
    s = T.toggle(s, t0 + 2 * MIN); // pause after 2
    s = T.toggle(s, t0 + 10 * MIN); // resume
    expect(T.elapsed(s, t0 + 13 * MIN)).toBe(5 * MIN);
  });

  it("reports the goal once", () => {
    let s = T.typed(T.armed("Ex.md", 10), t0);
    s = T.typed(s, t0 + 9.5 * MIN);
    const first = T.tick(s, t0 + 10 * MIN, 5 * MIN);
    expect(first.goalReached).toBe(true);
    expect(T.tick(first.state, t0 + 10 * MIN + 1000, 5 * MIN).goalReached).toBe(false);
  });

  it("reset goes back to armed with no time and the goal unreported", () => {
    let s = T.typed(T.armed("Ex.md", 1), t0);
    s = T.tick(s, t0 + 2 * MIN, 0).state;
    const r = T.reset(s);
    expect(r).toMatchObject({ phase: "armed", elapsedMs: 0, startedAt: null, goalNotified: false });
  });

  it("restore after a reload counts a running timer only up to the last keystroke", () => {
    let s = T.typed(T.armed("Ex.md", 0), t0);
    s = T.typed(s, t0 + 4 * MIN);
    const r = T.restore(s);
    expect(r.phase).toBe("paused");
    expect(r.pausedBy).toBe("idle");
    expect(T.elapsed(r, t0 + 60 * MIN)).toBe(4 * MIN);
  });

  it("logs whole minutes, rounded", () => {
    const s = { ...T.armed("Ex.md", 0), phase: "paused" as const, elapsedMs: 2.6 * MIN };
    expect(T.minutesToLog(s, t0)).toBe(3);
    expect(T.minutesToLog({ ...s, elapsedMs: 20_000 }, t0)).toBe(0);
  });

  it("formats the clock", () => {
    expect(T.clock(0)).toBe("0:00");
    expect(T.clock(65_000)).toBe("1:05");
    expect(T.clock(3_725_000)).toBe("1:02:05");
    expect(T.clock(-5)).toBe("0:00");
  });

  it("only accepts stored values shaped like a timer", () => {
    expect(T.isTimerState(T.armed("Ex.md", 5))).toBe(true);
    expect(T.isTimerState(null)).toBe(false);
    expect(T.isTimerState({ path: "x", phase: "flying" })).toBe(false);
    expect(T.isTimerState("timer")).toBe(false);
  });
});
