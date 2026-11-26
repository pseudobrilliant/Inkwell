/**
 * Writing blocks (see openspec/changes/writing-blocks, ADR 0006).
 *
 * A writing block is a `> [!writing]` callout holding the writing as it is now. Once reviewed, the first draft
 * and the block's mode sit in an Obsidian comment one blank line below it:
 *
 *     > [!writing] Opening
 *     > I have come back before.
 *
 *     %% writing-block first-draft review
 *     I have been here before.
 *     %%
 *
 * Everything here is pure: it reads and builds text by line. The editor, reading view and commands apply the results.
 */
import { presentableDiff } from "@codemirror/merge";

export type BlockMode = "writing" | "review" | "edited";
export const BLOCK_MODES: readonly BlockMode[] = ["writing", "review", "edited"];

export interface FirstDraft {
  /** Line of `%% writing-block first-draft <mode>`. */
  start: number;
  /** Line of the closing `%%`. */
  end: number;
  mode: BlockMode;
  text: string;
}

export interface WritingBlock {
  /** Line of the `> [!writing]` header (0-based). */
  start: number;
  /** Last line of the callout. */
  end: number;
  title: string;
  /** The writing, one entry per line, without the `> ` prefix. */
  lines: string[];
  /** The writing as it is now: `lines` joined with newlines. */
  text: string;
  /** The kept first draft, or null if the block has never been reviewed (or its comment can't be read). */
  firstDraft: FirstDraft | null;
  /** `firstDraft.mode`, or "writing" for a block that was never reviewed. */
  mode: BlockMode;
}

const HEADER = /^>\s*\[!writing(?:\|[^\]]*)?\][+-]?(?:\s+(.*?))?\s*$/i;
const COMMENT_OPEN = /^%%\s*writing-block\s+first-draft\s+(writing|review|edited)\s*$/;
const FENCE = /^\s*(```|~~~)/;

const clean = (line: string) => line.replace(/\r$/, "");

/** The writing on a callout line, without its `>` and one following space. */
function unquote(line: string): string {
  return clean(line).replace(/^>\s?/, "");
}

/**
 * A line without `>` that Markdown still counts as part of the callout: text straight after a line of writing
 * (CommonMark's "lazy continuation"). Obsidian shows it inside the box, so the block includes it too. Lines that
 * start something else (a heading, list, fence, rule, table or comment) end the block instead.
 */
function isLazyLine(line: string): boolean {
  const l = clean(line);
  if (l.trim() === "") return false;
  return !/^\s{0,3}(#{1,6}(\s|$)|```|~~~|([-*_])(\s*\3){2,}\s*$|[-*+]\s|\d{1,9}[.)]\s|<|%%|\|)/.test(l);
}

/** Whether a line is a writing block's header. */
export function isHeader(line: string): boolean {
  return HEADER.test(clean(line));
}

function readFirstDraft(lines: string[], blockEnd: number): FirstDraft | null {
  const blank = lines[blockEnd + 1];
  const open = lines[blockEnd + 2];
  if (blank === undefined || open === undefined || clean(blank).trim() !== "") return null;
  const m = clean(open).match(COMMENT_OPEN);
  if (!m) return null;
  for (let i = blockEnd + 3; i < lines.length; i++) {
    if (clean(lines[i] ?? "").trim() === "%%") {
      return {
        start: blockEnd + 2,
        end: i,
        mode: m[1] as BlockMode,
        text: lines.slice(blockEnd + 3, i).map(clean).join("\n"),
      };
    }
  }
  return null;
}

/** Every writing block in a note, in order. Headers inside fenced code or frontmatter are not blocks. */
export function findBlocks(text: string): WritingBlock[] {
  const lines = text.split("\n");
  const blocks: WritingBlock[] = [];
  let i = 0;
  if (clean(lines[0] ?? "") === "---") {
    const close = lines.findIndex((l, n) => n > 0 && clean(l) === "---");
    if (close > 0) i = close + 1;
  }
  let inFence = false;
  for (; i < lines.length; i++) {
    const line = clean(lines[i] ?? "");
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(HEADER);
    if (!m) continue;
    let end = i;
    for (;;) {
      const next = lines[end + 1];
      if (next === undefined) break;
      if (/^>/.test(next)) end++;
      else if (isLazyLine(next) && clean(unquote(lines[end] ?? "")).trim() !== "") end++;
      else break;
    }
    const body = lines.slice(i + 1, end + 1).map(unquote);
    const firstDraft = readFirstDraft(lines, end);
    blocks.push({
      start: i,
      end,
      title: m[1]?.trim() ?? "",
      lines: body,
      text: body.join("\n"),
      firstDraft,
      mode: firstDraft?.mode ?? "writing",
    });
    i = firstDraft ? firstDraft.end : end;
  }
  return blocks;
}

/** The block a line belongs to, counting its first-draft comment as part of it. */
export function blockAtLine(blocks: WritingBlock[], line: number): WritingBlock | null {
  return blocks.find((b) => line >= b.start && line <= (b.firstDraft?.end ?? b.end)) ?? null;
}

/** Callout lines for some writing: a header, then each line quoted. Blank lines stay as bare `>`. */
export function blockLines(writing: string[], title = ""): string[] {
  return [`> [!writing]${title ? " " + title : ""}`, ...writing.map((l) => (l.trim() === "" ? ">" : `> ${l}`))];
}

/** A new, empty block: the header and one empty line to write on, with the cursor after its `> `. */
export function emptyBlock(): string[] {
  return ["> [!writing]", "> "];
}

/** Wrap selected lines in a block, dropping blank lines at either end and keeping the rest as they are. */
export function wrapLines(selected: string[]): string[] {
  const lines = selected.map(clean);
  let a = 0;
  let b = lines.length;
  while (a < b && lines[a]?.trim() === "") a++;
  while (b > a && lines[b - 1]?.trim() === "") b--;
  return blockLines(lines.slice(a, b));
}

/** The run of tab-indented lines around a line, or null if that line doesn't start with a tab. */
export function tabbedRunAt(lines: string[], line: number): { start: number; end: number } | null {
  const tabbed = (n: number) => /^\t/.test(lines[n] ?? "");
  if (!tabbed(line)) return null;
  let start = line;
  let end = line;
  while (start > 0 && tabbed(start - 1)) start--;
  while (end + 1 < lines.length && tabbed(end + 1)) end++;
  return { start, end };
}

/** Turn tab-indented lines into a block: leading tabs go, each line stays its own paragraph. */
export function convertTabbed(lines: string[]): string[] {
  return blockLines(lines.map((l) => clean(l).replace(/^\t+/, "")));
}

/** The note with every block as plain paragraphs: the callout's lines unquoted, the first-draft comment removed. */
export function unwrapBlocks(text: string): string {
  const blocks = findBlocks(text);
  if (!blocks.length) return text;
  const lines = text.split("\n");
  for (const b of [...blocks].reverse()) {
    const to = b.firstDraft ? b.firstDraft.end : b.end;
    lines.splice(b.start, to - b.start + 1, ...b.lines);
  }
  return lines.join("\n");
}

// ---------- Keys inside a block (Live Preview) ----------
// Each function takes the note's text and the cursor offset, and returns the edit to make, or null to let the editor
// handle the key as usual. Offsets are plain string offsets, so they map one-to-one onto CodeMirror positions.

export interface TextChange {
  from: number;
  to: number;
  insert: string;
}

export interface KeyEdit {
  changes: TextChange[];
  cursor: number;
}

interface LineAt {
  index: number;
  from: number;
  to: number;
  text: string;
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  return starts;
}

function lineInfo(text: string, starts: number[], index: number): LineAt {
  const from = starts[index] ?? text.length;
  const next = starts[index + 1];
  const to = next === undefined ? text.length : next - 1;
  return { index, from, to, text: text.slice(from, to) };
}

/** Length of a callout line's `>` and the one space after it. */
export function prefixLength(line: string): number {
  return line.match(/^>\s?/)?.[0].length ?? 0;
}

/** The block whose writing (not header, not comment) holds the cursor, with the cursor's line. */
function bodyLineAt(text: string, pos: number): { block: WritingBlock; line: LineAt; starts: number[] } | null {
  const starts = lineStarts(text);
  let index = starts.length - 1;
  while (index > 0 && (starts[index] ?? 0) > pos) index--;
  const block = findBlocks(text).find((b) => index > b.start && index <= b.end);
  if (!block) return null;
  return { block, line: lineInfo(text, starts, index), starts };
}

/** Enter: a new paragraph in the block, or, on an empty last line after at least one paragraph, leave the block. */
export function enterAt(text: string, pos: number): KeyEdit | null {
  const at = bodyLineAt(text, pos);
  if (!at) return null;
  const { block, line, starts } = at;
  const p = prefixLength(line.text);
  const isEmpty = line.text.slice(p).trim() === "";
  if (isEmpty && line.index === block.end && block.end > block.start + 1) {
    const prev = lineInfo(text, starts, line.index - 1);
    if (block.firstDraft) {
      // Keep the blank line and comment below the block where they are: the cursor goes below the comment.
      const close = lineInfo(text, starts, block.firstDraft.end);
      const removed = line.to - prev.to;
      return {
        changes: [
          { from: prev.to, to: line.to, insert: "" },
          { from: close.to, to: close.to, insert: "\n" },
        ],
        cursor: close.to + 1 - removed,
      };
    }
    // A blank line between the block and what comes next: text straight after a callout line would join it.
    return { changes: [{ from: line.from, to: line.to, insert: "\n" }], cursor: line.from + 1 };
  }
  const cut = Math.max(pos, line.from + p);
  return { changes: [{ from: cut, to: cut, insert: "\n> " }], cursor: cut + 3 };
}

/**
 * Backspace at the start of a paragraph: join it to the one before. On the block's only line, if it's empty and
 * the block was never reviewed, remove the block. Otherwise at the first paragraph's start, do nothing: the header
 * is not something to delete into. Anywhere else, null.
 */
export function backspaceAt(text: string, pos: number): KeyEdit | null {
  const at = bodyLineAt(text, pos);
  if (!at) return null;
  const { block, line, starts } = at;
  const p = prefixLength(line.text);
  if (pos > line.from + p) return null;
  if (line.index === block.start + 1) {
    const onlyLine = block.end === block.start + 1;
    if (onlyLine && line.text.slice(p).trim() === "" && !block.firstDraft) {
      const header = lineInfo(text, starts, block.start);
      const from = header.from > 0 ? header.from - 1 : header.from;
      const to = header.from > 0 ? line.to : Math.min(line.to + 1, text.length);
      return { changes: [{ from, to, insert: "" }], cursor: from };
    }
    return { changes: [], cursor: pos };
  }
  const prev = lineInfo(text, starts, line.index - 1);
  return { changes: [{ from: prev.to, to: line.from + p, insert: "" }], cursor: prev.to };
}

/** Delete at the end of a paragraph: join the next paragraph of the block onto it. */
export function deleteAt(text: string, pos: number): KeyEdit | null {
  const at = bodyLineAt(text, pos);
  if (!at) return null;
  const { block, line, starts } = at;
  if (pos < line.to) return null;
  if (line.index === block.end) return { changes: [], cursor: pos };
  const next = lineInfo(text, starts, line.index + 1);
  return { changes: [{ from: line.to, to: next.from + prefixLength(next.text), insert: "" }], cursor: pos };
}

/** Text pasted into a block, with every new line quoted so it stays inside. */
export function quotePasted(pasted: string): string {
  return pasted.replace(/\r\n?/g, "\n").replace(/\n/g, "\n> ");
}

/** Whether an offset is in the writing of a block (not its header or comment). */
export function inBlockWriting(text: string, pos: number): boolean {
  return bodyLineAt(text, pos) !== null;
}

// ---------- "New writing block" ----------

export interface BlockInsert {
  /** First and last line (0-based, inclusive) replaced. `to` is `from - 1` for a pure insert before line `from`. */
  from: number;
  to: number;
  lines: string[];
  /** Where the cursor goes: a line within `lines`, and a column. */
  cursorLine: number;
  cursorCh: number;
}

/**
 * What "New writing block" does: wrap the selected lines, or convert the tab-indented run the cursor is in, or add
 * an empty block (on the cursor's line if it's blank, otherwise below it). A blank line keeps the next paragraph out
 * of the block (Markdown would otherwise join it to the callout).
 */
export function newBlockAt(lines: string[], selection: { fromLine: number; toLine: number; empty: boolean }): BlockInsert {
  const { fromLine, toLine, empty } = selection;
  const fence = (out: string[], after: number) => {
    const next = lines[after + 1];
    return next !== undefined && next.trim() !== "" ? [...out, ""] : out;
  };
  if (!empty) {
    const block = wrapLines(lines.slice(fromLine, toLine + 1));
    const last = block.length - 1;
    return { from: fromLine, to: toLine, lines: fence(block, toLine), cursorLine: last, cursorCh: (block[last] ?? "").length };
  }
  const run = tabbedRunAt(lines, fromLine);
  if (run) {
    const block = convertTabbed(lines.slice(run.start, run.end + 1));
    const last = block.length - 1;
    return { from: run.start, to: run.end, lines: fence(block, run.end), cursorLine: last, cursorCh: (block[last] ?? "").length };
  }
  const block = emptyBlock();
  if ((lines[fromLine] ?? "").trim() === "") {
    return { from: fromLine, to: fromLine, lines: fence(block, fromLine), cursorLine: 1, cursorCh: 2 };
  }
  return { from: fromLine + 1, to: fromLine, lines: fence(["", ...block], fromLine), cursorLine: 2, cursorCh: 2 };
}

// ---------- Modes and the first draft ----------

/** Why a block can't enter review, or null if it can. */
export function cannotReview(block: WritingBlock): string | null {
  if (block.text.includes("%%")) {
    return "This writing contains %%, which would end the hidden first draft early. Remove it to review.";
  }
  return null;
}

/** The comment that keeps a first draft, without the blank line before it. */
export function firstDraftComment(text: string, mode: BlockMode): string[] {
  return [`%% writing-block first-draft ${mode}`, ...text.split("\n"), "%%"];
}

export type ModeChange = { change: TextChange } | { refused: string } | { unchanged: true };

/**
 * Switch a block to a mode. The first switch away from Writing saves the block's text as the first draft below
 * it; after that, only the mode word in the comment changes. The writing itself is never touched.
 */
export function setMode(text: string, block: WritingBlock, mode: BlockMode): ModeChange {
  const starts = lineStarts(text);
  const fd = block.firstDraft;
  if (!fd) {
    if (mode === "writing") return { unchanged: true };
    const refused = cannotReview(block);
    if (refused) return { refused };
    const end = lineInfo(text, starts, block.end).to;
    return { change: { from: end, to: end, insert: "\n\n" + firstDraftComment(block.text, mode).join("\n") } };
  }
  if (fd.mode === mode) return { unchanged: true };
  const open = lineInfo(text, starts, fd.start);
  const word = open.text.match(/(writing|review|edited)\s*$/);
  if (!word || word.index === undefined) return { unchanged: true };
  const from = open.from + word.index;
  return { change: { from, to: from + fd.mode.length, insert: mode } };
}

// ---------- Guards while editing ----------

/**
 * Widen a deletion that removes the line break before a line of writing so it takes that line's `> ` too.
 * However the join happens (a selection, a key Inkwell doesn't handle), the `> ` never ends up mid-line.
 */
export function widenJoin(text: string, from: number, to: number): { from: number; to: number } {
  if (to <= from) return { from, to };
  const starts = lineStarts(text);
  for (const b of findBlocks(text)) {
    for (let n = b.start + 1; n <= b.end; n++) {
      const line = lineInfo(text, starts, n);
      const p = prefixLength(line.text);
      if (p > 0 && from < line.from && to >= line.from && to < line.from + p) return { from, to: line.from + p };
    }
  }
  return { from, to };
}

/** A block's kept first draft, with the blank line above it and the line break after it, as offsets. */
export interface GuardedDraft {
  /** The whole block, header to closing `%%`: deleting all of it at once is allowed. */
  blockFrom: number;
  /** The blank line above the comment, through the line break after its closing `%%`. */
  from: number;
  to: number;
  /** The comment itself, `%%` to `%%`: with the cursor in here, the writer is editing it by hand. */
  commentFrom: number;
  commentTo: number;
}

export function guardedDrafts(text: string): GuardedDraft[] {
  const starts = lineStarts(text);
  const out: GuardedDraft[] = [];
  for (const b of findBlocks(text)) {
    if (!b.firstDraft) continue;
    const open = lineInfo(text, starts, b.firstDraft.start);
    const close = lineInfo(text, starts, b.firstDraft.end);
    out.push({
      blockFrom: lineInfo(text, starts, b.start).from,
      from: lineInfo(text, starts, b.end).to + 1,
      to: Math.min(close.to + 1, text.length),
      commentFrom: open.from,
      commentTo: close.to,
    });
  }
  return out;
}

/**
 * Whether an edit (`from`–`to` replaced) would damage a kept first draft by accident: it touches the comment or the
 * blank line above it, while the cursor wasn't in the comment and the edit isn't deleting the whole block.
 */
export function damagesFirstDraft(drafts: GuardedDraft[], from: number, to: number, cursorFrom: number, cursorTo: number): boolean {
  return drafts.some((d) => {
    if (cursorTo >= d.commentFrom && cursorFrom <= d.commentTo) return false;
    if (from <= d.blockFrom && to >= d.commentTo) return false;
    if (to > from) return from < d.to && to > d.from;
    return from >= d.from && from < d.to;
  });
}

// ---------- Review: what changed since the first draft ----------

export interface DiffSegment {
  kind: "same" | "added" | "removed";
  text: string;
  /** Where the segment sits in the current text: its start, or for removed text, the point it was removed from. */
  at: number;
}

/**
 * The changes from the first draft to the current text, in order. Paragraph breaks are text too, so adding or
 * removing one is a change. Bounded in time: a very long, heavily rewritten block gets a coarser diff, never a hang.
 */
export function diffSegments(before: string, after: string): DiffSegment[] {
  const out: DiffSegment[] = [];
  let b = 0;
  for (const c of presentableDiff(before, after, { scanLimit: 2000, timeout: 50 })) {
    if (c.fromB > b) out.push({ kind: "same", text: after.slice(b, c.fromB), at: b });
    if (c.toA > c.fromA) out.push({ kind: "removed", text: before.slice(c.fromA, c.toA), at: c.fromB });
    if (c.toB > c.fromB) out.push({ kind: "added", text: after.slice(c.fromB, c.toB), at: c.fromB });
    b = c.toB;
  }
  if (b < after.length) out.push({ kind: "same", text: after.slice(b), at: b });
  return out;
}

export interface ReviewSpan {
  kind: "same" | "added" | "removed";
  text: string;
}

/** Shown for a paragraph break that was added or removed. */
export const BREAK_MARK = "¶";

/**
 * The review as paragraphs of spans, for drawing a rendered block: the current text's paragraphs, with removed
 * text in place. An added break ends its paragraph with a marked ¶; a removed one shows as a struck ¶ in the
 * paragraph it joined.
 */
export function reviewParagraphs(segments: DiffSegment[]): ReviewSpan[][] {
  const paras: ReviewSpan[][] = [[]];
  const push = (kind: ReviewSpan["kind"], text: string) => {
    if (text) paras[paras.length - 1]?.push({ kind, text });
  };
  for (const seg of segments) {
    const parts = seg.text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) {
        if (seg.kind === "removed") push("removed", BREAK_MARK);
        else {
          if (seg.kind === "added") push("added", BREAK_MARK);
          paras.push([]);
        }
      }
      push(seg.kind, part);
    });
  }
  return paras;
}

/** The current text's paragraphs, clean (Edited), as spans. */
export function plainParagraphs(text: string): ReviewSpan[][] {
  return text.split("\n").map((line) => (line ? [{ kind: "same" as const, text: line }] : []));
}

// ---------- Draft mode after review: the block is locked ----------

/** A reviewed block shown in Draft mode, from its header to the end of its first draft: read-only while editing. */
export interface LockedRange {
  from: number;
  to: number;
}

export function lockedRanges(text: string): LockedRange[] {
  const starts = lineStarts(text);
  return findBlocks(text)
    .filter((b) => b.firstDraft && b.mode === "writing")
    .map((b) => ({ from: lineInfo(text, starts, b.start).from, to: lineInfo(text, starts, b.firstDraft?.end ?? b.end).to }));
}

/**
 * Where the cursor goes if it would land inside a locked block: past it, in the direction it was moving
 * (below the block when coming from above or from a click inside, above it when coming from below).
 * Null if it's not inside one.
 */
export function outsideLocked(ranges: LockedRange[], head: number, previous: number, docLength: number): number | null {
  const r = ranges.find((x) => head > x.from && head < x.to) ?? ranges.find((x) => head === x.from && previous > x.to);
  if (!r) return null;
  if (previous >= r.to && r.from > 0) return r.from - 1;
  return Math.min(r.to + 1, docLength);
}

/** Whether an edit touches a locked block. Deleting the whole block at once is allowed. */
export function touchesLocked(ranges: LockedRange[], from: number, to: number): boolean {
  return ranges.some((r) => {
    if (from <= r.from && to >= r.to) return false;
    if (to > from) return from < r.to && to > r.from;
    return from > r.from && from < r.to;
  });
}
