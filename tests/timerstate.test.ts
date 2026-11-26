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

describe("timing by block", () => {
  const block = "> [!writing]\n> Draft words.";
  const exercise = `## Prompt\nWrite about rain.\n\n${block}\n\n## Reflection\nIt went well.`;
  const reviewed = (mode: string) => `> [!writing]\n> Revised.\n\n%% writing-block first-draft ${mode}\nFirst.\n%%`;
  const at = (text: string, s: string) => text.indexOf(s);

  it("typing outside a Draft block is not drafting", () => {
    const how = T.timing("exercise", exercise);
    expect(how).toBe("block");
    expect(T.countsAsTyping(how, exercise, at(exercise, "Write about rain."))).toBe(false);
    expect(T.countsAsTyping(how, exercise, at(exercise, "It went well."))).toBe(false);
    expect(T.countsAsTyping(how, exercise, at(exercise, "[!writing]"))).toBe(false);
  });

  it("typing in a reviewed block is not drafting", () => {
    const text = `${reviewed("review")}\n\n${block}`;
    const how = T.timing("exercise", text);
    expect(T.countsAsTyping(how, text, at(text, "Revised."))).toBe(false);
    expect(T.countsAsTyping(how, text, at(text, "Draft words."))).toBe(true);
    // Only drafting counts, so typing in the reviewed block lets the idle pause count up to the last draft keystroke.
    let s = T.typed(T.armed("Ex.md", 0), t0);
    if (T.countsAsTyping(how, text, at(text, "Revised."))) s = T.typed(s, t0 + 3 * MIN);
    const r = T.tick(s, t0 + 6 * MIN, 5 * MIN);
    expect(r.idlePaused).toBe(true);
    expect(T.elapsed(r.state, t0 + 6 * MIN)).toBe(0);
  });

  it("drafting in either of two blocks counts", () => {
    const text = `${block}\n\nBetween.\n\n> [!writing]\n> Second block.`;
    const how = T.timing("exercise", text);
    expect(T.countsAsTyping(how, text, at(text, "Draft words."))).toBe(true);
    expect(T.countsAsTyping(how, text, at(text, "Second block."))).toBe(true);
    let s = T.typed(T.armed("Ex.md", 0), t0);
    s = T.typed(s, t0 + 2 * MIN);
    s = T.typed(s, t0 + 5 * MIN);
    expect(T.elapsed(s, t0 + 5 * MIN)).toBe(5 * MIN);
  });

  it("drafting in a block starts the timer", () => {
    const how = T.timing("exercise", exercise);
    let s = T.armed("Ex.md", 10);
    // Reading and fixing the prompt first: still armed.
    if (T.countsAsTyping(how, exercise, at(exercise, "Write about rain."))) s = T.typed(s, t0);
    expect(s.phase).toBe("armed");
    if (T.countsAsTyping(how, exercise, at(exercise, "Draft words."))) s = T.typed(s, t0 + MIN);
    expect(s.phase).toBe("running");
    expect(T.elapsed(s, t0 + 3 * MIN)).toBe(2 * MIN);
  });

  it("a journal or an exercise without a block is timed as a whole note", () => {
    expect(T.timing("journal", "Today I wrote.")).toBe("note");
    expect(T.timing("exercise", "## Work\nNo block here.")).toBe("note");
    expect(T.countsAsTyping("note", "Today I wrote.", 0)).toBe(true);
  });

  it("only exercises are timed by block", () => {
    expect(T.timing("journal", block)).toBe("note");
    expect(T.timing("draft", block)).toBe("none");
    expect(T.timing("scene", block)).toBe("none");
    expect(T.timing("", block)).toBe("none");
    expect(T.countsAsTyping("none", block, at(block, "Draft words."))).toBe(false);
  });

  it("an exercise whose blocks are all reviewed has nothing to draft", () => {
    expect(T.hasDraftLeft(reviewed("edited"))).toBe(false);
    expect(T.hasDraftLeft(`${reviewed("writing")}\n\n${reviewed("review")}`)).toBe(false);
    expect(T.hasDraftLeft(`${reviewed("edited")}\n\n${block}`)).toBe(true);
    expect(T.hasDraftLeft(exercise)).toBe(true);
  });

  it("goal progress is the share of the goal written", () => {
    const s = T.typed(T.armed("Ex.md", 10), t0);
    expect(T.goalProgress(s, t0 + 2.5 * MIN)).toBe(0.25);
    expect(T.goalProgress(s, t0 + 10 * MIN)).toBe(1);
    expect(T.goalProgress(s, t0 + 14 * MIN)).toBe(1);
    expect(T.goalProgress(T.typed(T.armed("Ex.md", 0), t0), t0 + 5 * MIN)).toBeNull();
  });

  it("a first review stops the note's timer, and re-arms it while a block is still in draft", () => {
    const s = T.typed(T.armed("Ex.md", 10), t0);
    expect(T.afterFirstReview(s, "Ex.md", reviewed("review"))).toEqual({ log: true, rearmGoal: null });
    expect(T.afterFirstReview(s, "Ex.md", `${reviewed("review")}\n\n${block}`)).toEqual({ log: true, rearmGoal: 10 });
    expect(T.afterFirstReview(s, "Other.md", reviewed("review"))).toEqual({ log: false, rearmGoal: null });
    expect(T.afterFirstReview(null, "Ex.md", reviewed("review"))).toEqual({ log: false, rearmGoal: null });
  });
});
