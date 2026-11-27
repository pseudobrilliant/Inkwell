/**
 * Counting the words in writing blocks, and telling the writer's own edits from everything else (spec word-log).
 * Pure, and part of the block code: it imports only the block model, so the block can count without Inkwell.
 */
import { findBlocks, isHeader, type WritingBlock } from "./writingblocks";

/** Count prose words: ignores frontmatter, code blocks, comments (so a writing block's first draft), writing block headers, link targets. */
export function countWords(text: string): number {
  const prose = text
    .replace(/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/%%[\s\S]*?%%/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .split("\n")
    .filter((line) => !isHeader(line))
    .join("\n")
    .replace(/!?\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");
  return prose.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
}

/** The words in a note's writing blocks: each block's current text, never its first draft or anything outside it. */
export function blockWords(text: string): number {
  let n = 0;
  for (const b of findBlocks(text)) n += countWords(b.text);
  return n;
}

const plural = (n: number) => `${n.toLocaleString()} ${n === 1 ? "word" : "words"}`;

/**
 * What the word count tool shows for a block: the words in what the block shows, and, once reviewed, how far the
 * writing has moved from the first draft. A reviewed block in Draft mode shows its first draft, so it counts that.
 */
export function wordCountLabel(block: WritingBlock): { text: string; label: string } {
  const now = countWords(block.text);
  if (!block.firstDraft) return { text: plural(now), label: `${plural(now)} in this block` };
  const first = countWords(block.firstDraft.text);
  if (block.mode === "writing") return { text: plural(first), label: `${plural(first)} in the first draft` };
  const change = now - first;
  const sign = change > 0 ? "+" : change < 0 ? "−" : "±";
  return {
    text: `${plural(now)} (${sign}${Math.abs(change).toLocaleString()})`,
    label: `${plural(now)} now, ${plural(first)} in the first draft`,
  };
}

/** The user event on edits Inkwell's block keys make for the writer (Enter, Shift+Enter, Backspace, Delete in a block). */
export const INKWELL_EDIT = "inkwell.block-key";

/**
 * Whether an edit is the writer's own writing: typing, deleting, moving text, undo and redo, and Inkwell's block keys.
 * An edit with no user event (a note reloaded after sync or another app, Inkwell's own rewrites, a mode switch) isn't.
 */
export function countsAsWriting(userEvent: string | undefined): boolean {
  if (!userEvent) return false;
  if (userEvent === "undo" || userEvent === "redo" || userEvent === INKWELL_EDIT) return true;
  return ["input", "delete", "move"].some((e) => userEvent === e || userEvent.startsWith(e + "."));
}

/** Words written in a note's blocks, ready to log. */
export interface BlockWordsReport {
  sourcePath: string;
  words: number;
}

/**
 * The words the writer adds to an editor's blocks, without counting on every keystroke. The first counted edit records
 * the block words before it (the baseline). `settle` (after a pause, on blur, on close) reports the change since, and so
 * does an edit that isn't the writer's, up to the text before it, so a change from sync never lands in what's reported.
 */
export class BlockWordTally {
  private open: { sourcePath: string; words: number } | null = null;

  get counting(): boolean {
    return this.open !== null;
  }

  /** An edit changed the note. `before` is the note's text before it, read only when needed. */
  edit(counted: boolean, sourcePath: string | null, before: () => string): BlockWordsReport | null {
    if (!counted) return this.close(before);
    if (this.open && this.open.sourcePath === sourcePath) return null;
    const report = this.close(before);
    if (sourcePath !== null) this.open = { sourcePath, words: blockWords(before()) };
    return report;
  }

  /** The writer paused, left, or closed the note: report what changed, measured on the text now. */
  settle(now: () => string): BlockWordsReport | null {
    return this.close(now);
  }

  private close(text: () => string): BlockWordsReport | null {
    const open = this.open;
    if (!open) return null;
    this.open = null;
    const words = blockWords(text()) - open.words;
    return words ? { sourcePath: open.sourcePath, words } : null;
  }
}
