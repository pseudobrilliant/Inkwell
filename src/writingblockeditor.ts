/**
 * Writing blocks in Live Preview, while the cursor is inside one (Obsidian draws the callout itself otherwise).
 * The writer sees only the writing in its box: the `> [!writing]` header and each line's `> ` are hidden and the
 * cursor skips them, Enter and Backspace keep paragraphs inside the block, and pasted lines are quoted.
 * The key logic is pure (src/writingblocks.ts); this file only turns it into CodeMirror decorations and transactions.
 */
import { EditorSelection, EditorState, Prec, StateField, Transaction, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, keymap, WidgetType, type DecorationSet } from "@codemirror/view";
import { editorLivePreviewField, type Editor } from "obsidian";
import { backspaceAt, deleteAt, enterAt, findBlocks, inBlockWriting, newBlockAt, prefixLength, quotePasted, type KeyEdit, type WritingBlock } from "./writingblocks";
import { renderToolbar, switchInView, type WritingBlockHost } from "./writingblocktoolbar";

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
      if (!touches(open.from, close.to)) decos.push(firstDraftFold.range(open.from, close.to));
    }
    const toolbar = new ToolbarWidget(b, host);
    if (!touches(header.from, last.to)) {
      // Obsidian draws the callout; the toolbar sits just above it. Drawn here rather than inside Obsidian's
      // rendering, so it always shows the note's current mode (Obsidian doesn't redraw the callout when only the
      // comment below it changes).
      decos.push(Decoration.widget({ widget: toolbar, block: true, side: -1 }).range(header.from));
      continue;
    }
    // The header line becomes the toolbar; each line's `> ` is hidden. The cursor skips both.
    decos.push(Decoration.replace({ widget: toolbar, block: true }).range(header.from, header.to));
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
    }
  }
  return { decorations: Decoration.set(decos, true), hidden: Decoration.set(hidden, true) };
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

/** Run a pure key function at the cursor; false lets the editor handle the key. */
function runKey(key: (text: string, pos: number) => KeyEdit | null) {
  return (view: EditorView): boolean => {
    if (!livePreview(view.state)) return false;
    const sel = view.state.selection;
    if (sel.ranges.length !== 1 || !sel.main.empty) return false;
    const edit = key(view.state.doc.toString(), sel.main.head);
    if (!edit) return false;
    if (edit.changes.length) {
      view.dispatch({ changes: edit.changes, selection: EditorSelection.cursor(edit.cursor), scrollIntoView: true, userEvent: "input" });
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

/** Pasted or dropped lines inside a block get `> `, so they stay in the block. */
const quotePaste = EditorState.transactionFilter.of((tr: Transaction) => {
  if (!tr.docChanged || !(tr.isUserEvent("input.paste") || tr.isUserEvent("input.drop")) || !livePreview(tr.startState)) return tr;
  const before = tr.startState.doc.toString();
  const specs: { from: number; to: number; insert: string }[] = [];
  let quoted = false;
  let end = 0;
  let shift = 0;
  tr.changes.iterChanges((fromA, toA, _fromB, toB, inserted) => {
    let insert = inserted.toString();
    if (insert.includes("\n") && inBlockWriting(before, fromA)) {
      const q = quotePasted(insert);
      shift += q.length - insert.length;
      insert = q;
      quoted = true;
    }
    specs.push({ from: fromA, to: toA, insert });
    end = toB + shift;
  });
  if (!quoted) return tr;
  return { changes: specs, selection: EditorSelection.cursor(end), scrollIntoView: true, userEvent: tr.annotation(Transaction.userEvent) };
});

export function writingBlockEditor(host: WritingBlockHost): Extension {
  return [blockField(host), blockKeys, quotePaste];
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
