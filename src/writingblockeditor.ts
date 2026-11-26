/**
 * Writing blocks in Live Preview, while the cursor is inside one (Obsidian draws the callout itself otherwise).
 * The writer sees only the writing in its box: the `> [!writing]` header and each line's `> ` are hidden and the
 * cursor skips them, Enter and Backspace keep paragraphs inside the block, and pasted lines are quoted.
 * The key logic is pure (src/writingblocks.ts); this file only turns it into CodeMirror decorations and transactions.
 */
import { EditorSelection, EditorState, Prec, StateField, Transaction, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, keymap, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { editorInfoField, editorLivePreviewField, Notice, type Editor } from "obsidian";
import {
  backspaceAt,
  blockAtLine,
  breaksHeader,
  cursorStop,
  damagesFirstDraft,
  deleteAt,
  diffSegments,
  endsWithBreak,
  enterAt,
  findBlocks,
  guardedDrafts,
  inBlockWriting,
  keepApart,
  leaveAtEnd,
  lockedRanges,
  newBlockAt,
  outsideLocked,
  prefixLength,
  quotePasted,
  shiftEnterAt,
  touchesLocked,
  widenJoin,
  writingAt,
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

/** The path of the note this editor shows, or null (an editor with no file). */
function sourcePathOf(state: EditorState): string | null {
  return state.field(editorInfoField, false)?.file?.path ?? null;
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
    const sourcePath = sourcePathOf(view.state);
    renderToolbar(line, this.block, (mode) => switchInView(view, sourcePath, this.block.start, mode, this.host), {
      sourcePath,
      tools: this.host.tools,
    });
    return line;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

/**
 * The kept first draft, folded to one quiet line so it doesn't sit under the writing. The cursor passes over it;
 * only a click on it opens it, for editing by hand.
 */
class FirstDraftWidget extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    const el = view.dom.createDiv({ cls: "inkwell-wb-first-draft", text: "First draft kept" });
    el.remove();
    el.setAttr("aria-label", "Click to open the first draft and edit it by hand");
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      let pos: number;
      try {
        pos = view.posAtDOM(el);
      } catch {
        return;
      }
      // The start of the draft's text: strictly inside the comment, so it unfolds and stays open.
      const at = Math.min(view.state.doc.lineAt(pos).to + 1, view.state.doc.length);
      view.dispatch({ selection: EditorSelection.cursor(at), scrollIntoView: true, userEvent: "select.pointer" });
      view.focus();
    });
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
    const shown = this.text.replace(/\\?\n/g, " ");
    const el = view.dom.createSpan({ cls: "inkwell-wb-removed", text: shown });
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
      // A removed paragraph break on its own isn't marked: the joined text shows it.
      if (seg.text.replace(/\\?\n/g, "").trim() === "") continue;
      out.push(Decoration.widget({ widget: new RemovedWidget(seg.text), side: -1 }).range(toDoc(seg.at)));
    } else if (seg.kind === "added") {
      let at = seg.at;
      for (const part of seg.text.split("\n").map((t, i, all) => ({ t, brk: i < all.length - 1 }))) {
        if (part.t) out.push(addedMark.range(toDoc(at), toDoc(at + part.t.length)));
        at += part.t.length;
        if (part.brk) at += 1;
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
  const within = (from: number, to: number) => state.selection.ranges.some((r) => r.from > from && r.to < to);
  for (const b of findBlocks(text)) {
    const header = doc.line(b.start + 1);
    const last = doc.line(b.end + 1);
    if (b.firstDraft) {
      const open = doc.line(b.firstDraft.start + 1);
      const close = doc.line(b.firstDraft.end + 1);
      // Folded unless the cursor is strictly inside it (opened with a click), so arriving next to it never opens
      // it. The cursor skips it and the blank line above it in one step.
      if (!within(open.from, close.to)) {
        decos.push(firstDraftFold.range(open.from, close.to));
        hidden.push(hide.range(last.to, close.to));
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
      // A Shift+Enter line: same paragraph, no first-line indent.
      if (n > b.start + 1 && endsWithBreak(b.lines[n - b.start - 2] ?? "")) cls.push("inkwell-wb-cont");
      decos.push(Decoration.line({ class: cls.join(" ") }).range(line.from));
      const p = prefixLength(line.text);
      if (p > 0) {
        decos.push(hide.range(line.from, line.from + p));
        if (n > b.start + 1) hidden.push(hide.range(line.from, line.from + p));
      }
      if (line.text.slice(p).length === 0) decos.push(indentAnchor.range(line.to));
      // The `\` that saves a Shift+Enter line break is hidden; the cursor skips it.
      if (endsWithBreak(line.text) && line.to - 1 >= line.from + p) {
        decos.push(hide.range(line.to - 1, line.to));
        hidden.push(hide.range(line.to - 1, line.to));
      }
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
          const sourcePath = sourcePathOf(this.view.state);
          const bar = renderToolbar(callout, block, (mode) => switchInView(this.view, sourcePath, block.start, mode, host), {
            sourcePath,
            tools: host.tools,
          });
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
    { key: "Shift-Enter", run: runKey(shiftEnterAt) },
    { key: "Backspace", run: runKey(backspaceAt) },
    { key: "Mod-Backspace", run: runKey(backspaceAt) },
    { key: "Alt-Backspace", run: runKey(backspaceAt) },
    { key: "Delete", run: runKey(deleteAt) },
    { key: "ArrowDown", run: leaveDown },
  ])
);

/** Down arrow on the last line of a block at the very end of the note: make a line below it, so there's a way out. */
function leaveDown(view: EditorView): boolean {
  if (!livePreview(view.state)) return false;
  const sel = view.state.selection;
  if (sel.ranges.length !== 1 || !sel.main.empty) return false;
  const head = sel.main.head;
  const edit = leaveAtEnd(view.state.doc.toString(), head);
  if (!edit) return false;
  // Only from the paragraph's last visual line: a wrapped paragraph moves down within itself first.
  const here = view.coordsAtPos(head);
  const end = view.coordsAtPos(view.state.doc.lineAt(head).to);
  if (here && end && Math.abs(here.top - end.top) > 1) return false;
  view.dispatch({ changes: edit.changes, selection: EditorSelection.cursor(edit.cursor), scrollIntoView: true, userEvent: INKWELL_EDIT });
  return true;
}

/**
 * Every edit the writer makes, checked against the block before it lands:
 * - one that would break a block's hidden header, or change the folded first draft by accident, is refused, with a
 *   notice;
 * - one that removes a line's `> ` (a join, a whole selected paragraph) keeps every line of writing quoted;
 * - pasted or dropped lines get `> `, so they stay in the block;
 * - text typed straight below a block starts a line further down, so it doesn't join the block.
 */
const guardEdits = EditorState.transactionFilter.of((tr: Transaction) => {
  if (!tr.docChanged || !livePreview(tr.startState)) return tr;
  if (!(tr.isUserEvent("input") || tr.isUserEvent("delete") || tr.isUserEvent("move"))) return tr;
  const before = tr.startState.doc.toString();
  const drafts = guardedDrafts(before);
  const locked = lockedRanges(before);
  const sel = tr.startState.selection.main;
  let refusal: string | null = null;
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    const insert = inserted.toString();
    if (refusal) return;
    if (touchesLocked(locked, fromA, toA, insert)) refusal = "This block is showing its first draft. To revise it, pick another mode on its toolbar.";
    else if (damagesFirstDraft(drafts, fromA, toA, sel.from, sel.to, insert)) {
      refusal = "The first draft is kept below this block. Click it to open it if you want to edit it by hand.";
    } else if (breaksHeader(before, fromA, toA, insert)) refusal = "That would break the writing block. To remove it, select the whole block.";
  });
  if (refusal) {
    new Notice(refusal);
    return [];
  }
  const paste = tr.isUserEvent("input.paste") || tr.isUserEvent("input.drop");
  const specs: { from: number; to: number; insert: string }[] = [];
  let rewritten = false;
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    const original = inserted.toString();
    let insert = original;
    if (paste && insert.includes("\n") && inBlockWriting(before, fromA)) insert = quotePasted(insert);
    const wide = widenJoin(before, fromA, toA, insert);
    const apart = keepApart(before, wide.from, wide.to, wide.insert);
    if (apart.from !== fromA || apart.to !== toA || apart.insert !== original) rewritten = true;
    specs.push(apart);
  });
  if (!rewritten) return tr;
  const changes = tr.startState.changes(specs);
  // Put the cursor where the original edit put it: at the end of its last insertion.
  const last = specs[specs.length - 1];
  const cursor = last ? changes.mapPos(last.from, -1) + last.insert.length : changes.mapPos(sel.head);
  return { changes, selection: EditorSelection.cursor(cursor), scrollIntoView: true, userEvent: tr.annotation(Transaction.userEvent) };
});

/**
 * Keep the cursor where the writer can see it: out of locked blocks (Draft mode after review, so Obsidian keeps
 * showing them rendered), off a block's hidden header, and past its folded first draft.
 */
const keepCursorVisible = EditorState.transactionFilter.of((tr: Transaction) => {
  if (!tr.selection && !tr.docChanged) return tr;
  if (!livePreview(tr.state)) return tr;
  const text = tr.newDoc.toString();
  const main = tr.newSelection.main;
  const head = main.head;
  const previous = tr.changes.mapPos(tr.startState.selection.main.head);
  const ranges = lockedRanges(text);
  let moved = ranges.length ? outsideLocked(ranges, head, previous, text.length) : null;
  if (moved === null && main.empty) moved = cursorStop(text, head, previous, tr.isUserEvent("select.pointer"));
  if (moved === null || moved === head) return tr;
  return [tr, { selection: EditorSelection.cursor(moved), sequential: true }];
});

/**
 * Tells the host when the writer starts or stops writing in a block. Only a focused editor counts as writing, so a
 * note left open in another pane never claims it; losing focus alone doesn't end it (a click on the toolbar, the
 * command palette), but focusing another editor, or closing this one, does.
 */
function writingWatch(host: WritingBlockHost) {
  return ViewPlugin.fromClass(
    class {
      private writing = false;

      constructor(readonly view: EditorView) {
        this.check();
      }

      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet || u.focusChanged || u.startState.field(editorLivePreviewField, false) !== u.state.field(editorLivePreviewField, false)) {
          this.check();
        }
      }

      destroy() {
        this.set(false);
      }

      check() {
        const { state } = this.view;
        if (!this.view.hasFocus) {
          // Another editor took focus: it reports for itself, so this one stops.
          if (this.writing && this.view.dom.ownerDocument.activeElement?.closest(".cm-editor")) this.set(false);
          return;
        }
        const sel = state.selection;
        this.set(livePreview(state) && sel.ranges.length === 1 && writingAt(state.doc.toString(), sel.main.head));
      }

      set(writing: boolean) {
        if (writing === this.writing) return;
        this.writing = writing;
        host.onWritingInBlock(writing);
      }
    }
  );
}

export function writingBlockEditor(host: WritingBlockHost): Extension {
  return [blockField(host), blockKeys, guardEdits, keepCursorVisible, renderedToolbars(host), writingWatch(host)];
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
