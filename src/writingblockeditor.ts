/**
 * Writing blocks in Live Preview, while the cursor is inside one (Obsidian draws the callout itself otherwise).
 * The writer sees only the writing in its box: the `> [!writing]` header and each line's `> ` are hidden and the
 * cursor skips them, Enter and Backspace keep paragraphs inside the block, and pasted lines are quoted.
 * The key logic is pure (src/writingblocks.ts); this file only turns it into CodeMirror decorations and transactions.
 */
import { EditorSelection, EditorState, Prec, StateField, Transaction, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, keymap, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { editorLivePreviewField, Notice, type Editor } from "obsidian";
import {
  backspaceAt,
  blockAtLine,
  BREAK_MARK,
  damagesFirstDraft,
  deleteAt,
  diffSegments,
  enterAt,
  findBlocks,
  guardedDrafts,
  inBlockWriting,
  lockedRanges,
  newBlockAt,
  outsideLocked,
  prefixLength,
  quotePasted,
  touchesLocked,
  widenJoin,
  type KeyEdit,
  type WritingBlock,
} from "./writingblocks";
import { renderToolbar, switchInView, type WritingBlockHost } from "./writingblocktoolbar";
import { drawBlockBody } from "./writingblockview";

interface BlockDecorations {
  decorations: DecorationSet;
  /** The hidden Markdown, which the cursor skips over. */
  hidden: DecorationSet;
}

const NONE: BlockDecorations = { decorations: Decoration.none, hidden: Decoration.none };
const hide = Decoration.replace({});

function livePreview(state: EditorState): boolean {
  return state.field(editorLivePreviewField, false) ?? false;
}

/** The block's toolbar, standing in for its `> [!writing]` header line while the cursor is in the block. */
class ToolbarWidget extends WidgetType {
  constructor(
    private block: WritingBlock,
    private host: WritingBlockHost
  ) {
    super();
  }

  eq(other: ToolbarWidget): boolean {
    return other.block.start === this.block.start && other.block.mode === this.block.mode && other.block.end === this.block.end;
  }

  toDOM(view: EditorView): HTMLElement {
    const line = view.dom.createDiv({ cls: "inkwell-wb-toolbar-line" });
    line.remove();
    renderToolbar(line, this.block, (mode) => switchInView(view, this.block.start, mode, this.host));
    return line;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

/** The kept first draft, folded to one quiet line so it doesn't sit under the writing. */
class FirstDraftWidget extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    const el = view.dom.createDiv({ cls: "inkwell-wb-first-draft", text: "First draft kept" });
    el.remove();
    return el;
  }
}
const firstDraftFold = Decoration.replace({ widget: new FirstDraftWidget(), block: true });

/**
 * An invisible, zero-width mark on an empty line of writing. With the `> ` hidden, an empty line has nothing to
 * measure the first-line indent from, so the cursor would sit at the box's edge until you type.
 */
class IndentAnchor extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    const el = view.dom.createSpan({ cls: "inkwell-wb-anchor", text: "\u200b" });
    el.remove();
    return el;
  }
}
const indentAnchor = Decoration.widget({ widget: new IndentAnchor(), side: 1 });

/** Text removed since the first draft, shown struck through where it was. */
class RemovedWidget extends WidgetType {
  constructor(private text: string) {
    super();
  }

  eq(other: RemovedWidget): boolean {
    return other.text === this.text;
  }

  toDOM(view: EditorView): HTMLElement {
    const el = view.dom.createSpan({ cls: "inkwell-wb-removed", text: this.text.split("\n").join(` ${BREAK_MARK} `) });
    el.remove();
    return el;
  }
}

/** A paragraph break added since the first draft, marked at the end of the line it ends. */
class AddedBreakWidget extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    const el = view.dom.createSpan({ cls: "inkwell-wb-added inkwell-wb-break", text: BREAK_MARK });
    el.remove();
    return el;
  }
}
const addedMark = Decoration.mark({ class: "inkwell-wb-added" });

/** Review marks for a block, as decorations: its text offsets mapped to the note through each line's hidden `> `. */
function reviewDecorations(state: EditorState, b: WritingBlock, firstDraft: string): Range<Decoration>[] {
  const doc = state.doc;
  // Where each line of the block's text starts, in the text and in the note.
  const lines: { textFrom: number; docFrom: number; length: number }[] = [];
  let textFrom = 0;
  for (let n = b.start + 1; n <= b.end; n++) {
    const line = doc.line(n + 1);
    const p = prefixLength(line.text);
    lines.push({ textFrom, docFrom: line.from + p, length: line.length - p });
    textFrom += line.length - p + 1;
  }
  const toDoc = (offset: number) => {
    for (const l of lines) if (offset <= l.textFrom + l.length) return l.docFrom + Math.max(0, offset - l.textFrom);
    const last = lines[lines.length - 1];
    return last ? last.docFrom + last.length : doc.line(b.start + 1).to;
  };
  const out: Range<Decoration>[] = [];
  for (const seg of diffSegments(firstDraft, b.text)) {
    if (seg.kind === "removed") {
      out.push(Decoration.widget({ widget: new RemovedWidget(seg.text), side: -1 }).range(toDoc(seg.at)));
    } else if (seg.kind === "added") {
      let at = seg.at;
      for (const part of seg.text.split("\n").map((t, i, all) => ({ t, brk: i < all.length - 1 }))) {
        if (part.t) out.push(addedMark.range(toDoc(at), toDoc(at + part.t.length)));
        at += part.t.length;
        if (part.brk) {
          out.push(Decoration.widget({ widget: new AddedBreakWidget(), side: 1 }).range(toDoc(at)));
          at += 1;
        }
      }
    }
  }
  return out;
}

function build(state: EditorState, host: WritingBlockHost): BlockDecorations {
  if (!livePreview(state)) return NONE;
  const doc = state.doc;
  const text = doc.toString();
  const decos: Range<Decoration>[] = [];
  const hidden: Range<Decoration>[] = [];
  const touches = (from: number, to: number) => state.selection.ranges.some((r) => r.to >= from && r.from <= to);
  for (const b of findBlocks(text)) {
    const header = doc.line(b.start + 1);
    const last = doc.line(b.end + 1);
    if (b.firstDraft) {
      const open = doc.line(b.firstDraft.start + 1);
      const close = doc.line(b.firstDraft.end + 1);
      // Folded unless the cursor is in it, so it can still be edited or deleted by hand.
      if (!touches(open.from, close.to)) {
        decos.push(firstDraftFold.range(open.from, close.to));
        hidden.push(hide.range(open.from, close.to));
      }
    }
    // With the cursor elsewhere, Obsidian draws the callout, and `renderedToolbars` adds the toolbar to it.
    // A reviewed block in Draft mode is locked: the cursor never enters it, so it always stays rendered.
    if (!touches(header.from, last.to) || (b.firstDraft && b.mode === "writing")) continue;
    if (b.firstDraft && b.mode === "review") decos.push(...reviewDecorations(state, b, b.firstDraft.text));
    // The header line becomes the toolbar; each line's `> ` is hidden. The cursor skips both.
    decos.push(Decoration.replace({ widget: new ToolbarWidget(b, host), block: true }).range(header.from, header.to));
    if (b.end === b.start) {
      hidden.push(hide.range(header.from, header.to));
      continue;
    }
    const first = doc.line(b.start + 2);
    hidden.push(hide.range(header.from, first.from + prefixLength(first.text)));
    for (let n = b.start + 1; n <= b.end; n++) {
      const line = doc.line(n + 1);
      const cls = ["inkwell-wb-line"];
      if (n === b.start + 1) cls.push("inkwell-wb-first");
      if (n === b.end) cls.push("inkwell-wb-last");
      decos.push(Decoration.line({ class: cls.join(" ") }).range(line.from));
      const p = prefixLength(line.text);
      if (p > 0) {
        decos.push(hide.range(line.from, line.from + p));
        if (n > b.start + 1) hidden.push(hide.range(line.from, line.from + p));
      }
      if (line.text.slice(p).length === 0) decos.push(indentAnchor.range(line.to));
    }
  }
  return { decorations: Decoration.set(decos, true), hidden: Decoration.set(hidden, true) };
}

/**
 * The toolbar on blocks Obsidian draws itself (Live Preview, cursor elsewhere). Obsidian doesn't redraw a callout
 * when only the comment below it changes, so the toolbar is kept in step from the note's text after every update,
 * and whenever Obsidian (re)draws a callout.
 */
/** What each rendered callout last showed, so it's only redrawn when its mode or text changes. */
const drawn = new WeakMap<HTMLElement, string>();

function renderedToolbars(host: WritingBlockHost) {
  return ViewPlugin.fromClass(
    class {
      private observer: MutationObserver;

      constructor(readonly view: EditorView) {
        this.observer = new MutationObserver(() => this.schedule());
        this.observer.observe(view.contentDOM, { childList: true, subtree: true });
        this.schedule();
      }

      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged || u.selectionSet) this.schedule();
      }

      destroy() {
        this.observer.disconnect();
      }

      schedule() {
        this.view.requestMeasure({ key: this, read: () => null, write: () => this.sync() });
      }

      sync() {
        if (!livePreview(this.view.state)) return;
        const blocks = findBlocks(this.view.state.doc.toString());
        for (const callout of Array.from(this.view.contentDOM.querySelectorAll<HTMLElement>('.callout[data-callout="writing"]'))) {
          let pos: number;
          try {
            pos = this.view.posAtDOM(callout);
          } catch {
            continue;
          }
          const line = this.view.state.doc.lineAt(pos).number - 1;
          const block = blocks.find((b) => b.start === line) ?? blockAtLine(blocks, line);
          if (!block) continue;
          const current = callout.querySelector<HTMLElement>(":scope > .inkwell-wb-toolbar");
          const key = `${block.start}:${block.mode}`;
          const shown = `${key}\u0001${block.text}\u0001${block.firstDraft?.text ?? ""}`;
          if (current?.dataset.block === key && drawn.get(callout) === shown) continue;
          drawn.set(callout, shown);
          drawBlockBody(callout, block);
          current?.remove();
          callout.addClass("inkwell-wb-has-toolbar");
          const bar = renderToolbar(callout, block, (mode) => switchInView(this.view, block.start, mode, host));
          bar.dataset.block = key;
          callout.prepend(bar);
        }
      }
    }
  );
}

function blockField(host: WritingBlockHost) {
  return StateField.define<BlockDecorations>({
    create: (state) => build(state, host),
    update(value, tr) {
      if (!tr.docChanged && !tr.selection && tr.startState.field(editorLivePreviewField, false) === tr.state.field(editorLivePreviewField, false)) {
        return value;
      }
      return build(tr.state, host);
    },
    provide: (f) => [EditorView.decorations.from(f, (v) => v.decorations), EditorView.atomicRanges.of((view) => view.state.field(f).hidden)],
  });
}

/** Edits Inkwell makes itself. The guard below leaves them alone: they already keep the block whole. */
const INKWELL_EDIT = "inkwell.block-key";

/** Run a pure key function at the cursor; false lets the editor handle the key. */
function runKey(key: (text: string, pos: number) => KeyEdit | null) {
  return (view: EditorView): boolean => {
    if (!livePreview(view.state)) return false;
    const sel = view.state.selection;
    if (sel.ranges.length !== 1 || !sel.main.empty) return false;
    const edit = key(view.state.doc.toString(), sel.main.head);
    if (!edit) return false;
    if (edit.changes.length) {
      view.dispatch({ changes: edit.changes, selection: EditorSelection.cursor(edit.cursor), scrollIntoView: true, userEvent: INKWELL_EDIT });
    }
    return true;
  };
}

const blockKeys = Prec.highest(
  keymap.of([
    { key: "Enter", run: runKey(enterAt) },
    { key: "Backspace", run: runKey(backspaceAt) },
    { key: "Mod-Backspace", run: runKey(backspaceAt) },
    { key: "Alt-Backspace", run: runKey(backspaceAt) },
    { key: "Delete", run: runKey(deleteAt) },
  ])
);

/**
 * Every edit the writer makes, checked against the block before it lands:
 * - one that would change the folded first draft by accident is refused, with a notice;
 * - a join that removes a line break takes the next line's `> ` too, so it never ends up mid-line;
 * - pasted or dropped lines get `> `, so they stay in the block.
 */
const guardEdits = EditorState.transactionFilter.of((tr: Transaction) => {
  if (!tr.docChanged || !livePreview(tr.startState)) return tr;
  if (!(tr.isUserEvent("input") || tr.isUserEvent("delete") || tr.isUserEvent("move"))) return tr;
  const before = tr.startState.doc.toString();
  const drafts = guardedDrafts(before);
  const sel = tr.startState.selection.main;
  let damages = false;
  tr.changes.iterChangedRanges((fromA, toA) => {
    if (damagesFirstDraft(drafts, fromA, toA, sel.from, sel.to)) damages = true;
  });
  if (damages) {
    new Notice("The first draft is kept below this block. Click it to open it if you want to edit it by hand.");
    return [];
  }
  const locked = lockedRanges(before);
  let intoLocked = false;
  tr.changes.iterChangedRanges((fromA, toA) => {
    if (touchesLocked(locked, fromA, toA)) intoLocked = true;
  });
  if (intoLocked) {
    new Notice("This block is showing its first draft. To revise it, pick another mode on its toolbar.");
    return [];
  }
  const paste = tr.isUserEvent("input.paste") || tr.isUserEvent("input.drop");
  const specs: { from: number; to: number; insert: string }[] = [];
  let rewritten = false;
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    let insert = inserted.toString();
    const wide = widenJoin(before, fromA, toA);
    if (wide.to !== toA) rewritten = true;
    if (paste && insert.includes("\n") && inBlockWriting(before, fromA)) {
      insert = quotePasted(insert);
      rewritten = true;
    }
    specs.push({ from: wide.from, to: wide.to, insert });
  });
  if (!rewritten) return tr;
  const changes = tr.startState.changes(specs);
  // Put the cursor where the original edit put it: at the end of its last insertion.
  const last = specs[specs.length - 1];
  const cursor = last ? changes.mapPos(last.from, -1) + last.insert.length : changes.mapPos(sel.head);
  return { changes, selection: EditorSelection.cursor(cursor), scrollIntoView: true, userEvent: tr.annotation(Transaction.userEvent) };
});

/** Keep the cursor out of locked blocks (Draft mode after review), so Obsidian keeps showing them rendered. */
const keepOutOfLocked = EditorState.transactionFilter.of((tr: Transaction) => {
  if (!tr.selection && !tr.docChanged) return tr;
  if (!livePreview(tr.state)) return tr;
  const text = tr.newDoc.toString();
  const ranges = lockedRanges(text);
  if (!ranges.length) return tr;
  const head = tr.newSelection.main.head;
  const moved = outsideLocked(ranges, head, tr.startState.selection.main.head, text.length);
  if (moved === null) return tr;
  return [tr, { selection: EditorSelection.cursor(moved), sequential: true }];
});

export function writingBlockEditor(host: WritingBlockHost): Extension {
  return [blockField(host), blockKeys, guardEdits, keepOutOfLocked, renderedToolbars(host)];
}

/** "New writing block": wrap the selection, convert the tabbed run under the cursor, or add an empty block. */
export function newWritingBlock(editor: Editor): void {
  const lines: string[] = [];
  for (let i = 0; i < editor.lineCount(); i++) lines.push(editor.getLine(i));
  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
  // A selection ending at the start of a line doesn't include that line.
  const toLine = to.line > from.line && to.ch === 0 ? to.line - 1 : to.line;
  const edit = newBlockAt(lines, { fromLine: from.line, toLine, empty: !editor.somethingSelected() });
  const text = edit.lines.join("\n");
  if (edit.to >= edit.from) {
    editor.replaceRange(text, { line: edit.from, ch: 0 }, { line: edit.to, ch: (lines[edit.to] ?? "").length });
  } else {
    const prev = edit.from - 1;
    editor.replaceRange("\n" + text, { line: prev, ch: (lines[prev] ?? "").length });
  }
  editor.setCursor({ line: edit.from + edit.cursorLine, ch: edit.cursorCh });
}
