/**
 * The writing block's toolbar, and switching a block's mode from it (or from a command).
 * One toolbar is drawn in both places a block appears: the rendered callout's title, and the header line while
 * editing, so it looks the same in each. What it shows comes from the block type: for the writing block, its modes.
 *
 * Writing blocks don't depend on the rest of Inkwell (design decision 10). The host (Inkwell) passes in what it
 * wants done around a switch, such as stopping the writing timer, through `WritingBlockHost`.
 */
import { Notice, type App, type Editor, type TFile } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { BLOCK_MODES, findBlocks, setMode, type BlockMode, type TextChange, type WritingBlock } from "./writingblocks";

/**
 * A control the host adds to a block's toolbar, drawn at the far right, after the modes (design decision 9). The tool decides for
 * itself whether to show anything for this block; the block code knows nothing about what it does.
 */
export interface BlockTool {
  id: string;
  /** Draw into `el` for this block, or leave it empty. Called on each toolbar draw. */
  render(el: HTMLElement, ctx: { sourcePath: string; block: WritingBlock }): void;
}

/** Where a toolbar is drawn: the note it's in (null for an embed with no file), and the tools to draw. */
export interface ToolbarContext {
  sourcePath: string | null;
  tools: readonly BlockTool[];
}

export interface WritingBlockHost {
  /** Tools shown in every block's toolbar, at the far right after the modes. */
  tools: readonly BlockTool[];
  /** Called when a block first leaves Draft mode and its first draft is saved, with the note's path and text after it. */
  onFirstDraftSaved(note: { sourcePath: string; text: string }): void;
  /**
   * Called when the writer starts or stops writing in a block: the cursor moves into or out of one in the focused
   * editor (Live Preview), or that editor closes. Called only when the answer changes, for each editor.
   */
  onWritingInBlock(writing: boolean): void;
  /**
   * Called with the net words the writer added to a note's blocks (negative when they cut), after they pause, leave
   * the editor or close it. Only the writer's own edits count: never a mode switch, Inkwell's rewrites or sync.
   */
  onBlockWords(sourcePath: string, words: number): void;
}

export interface BlockType {
  id: string;
  modes: readonly { mode: BlockMode; label: string }[];
}

/** The writing block: write, review your changes, read the edited text. More types come later (idea writing-block-types). */
export const WRITING_BLOCK: BlockType = {
  id: "writing",
  modes: BLOCK_MODES.map((mode) => ({ mode, label: mode === "writing" ? "Draft" : mode === "review" ? "Review" : "Edited" })),
};

/** The type of a block. Only the writing block exists so far, so every writing callout is one. */
export function blockTypeOf(_block: WritingBlock): BlockType {
  return WRITING_BLOCK;
}

/** Draw a block's toolbar into `container`: its modes, the current one marked, then the host's tools at the far right. */
export function renderToolbar(container: HTMLElement, block: WritingBlock, onPick: (mode: BlockMode) => void, ctx: ToolbarContext): HTMLElement {
  const bar = container.createDiv({ cls: "inkwell-wb-toolbar" });
  bar.setAttr("role", "toolbar");
  const modes = bar.createDiv({ cls: "inkwell-wb-modes" });
  for (const { mode, label } of blockTypeOf(block).modes) {
    const button = modes.createEl("button", { cls: "inkwell-wb-mode", text: label });
    button.setAttr("aria-pressed", String(mode === block.mode));
    if (mode === block.mode) button.addClass("is-active");
    // Keep the editor's cursor where it is: a click on the toolbar is not a click in the writing,
    // and on Obsidian's rendered callout, not a click that opens its Markdown.
    button.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (mode !== block.mode) onPick(mode);
    });
  }
  const { sourcePath } = ctx;
  if (sourcePath !== null && ctx.tools.length) {
    const tools = bar.createDiv({ cls: "inkwell-wb-tools" });
    for (const tool of ctx.tools) {
      const el = tools.createSpan({ cls: "inkwell-wb-tool" });
      el.dataset.tool = tool.id;
      tool.render(el, { sourcePath, block });
    }
  }
  return bar;
}

/** The change for switching the block that starts at `line`, with any refusal shown as a notice. */
function modeChange(text: string, line: number, mode: BlockMode, host: WritingBlockHost): { change: TextChange; firstSave: boolean } | null {
  const block = findBlocks(text).find((b) => b.start === line);
  if (!block) return null;
  const r = setMode(text, block, mode);
  if ("refused" in r) {
    new Notice(r.refused);
    return null;
  }
  if ("unchanged" in r) return null;
  return { change: r.change, firstSave: !block.firstDraft };
}

/** Switch a block in an open editor (Live Preview or source mode). One transaction, so undo reverses it. */
export function switchInView(view: EditorView, sourcePath: string | null, line: number, mode: BlockMode, host: WritingBlockHost): void {
  const r = modeChange(view.state.doc.toString(), line, mode, host);
  if (!r) return;
  view.dispatch({ changes: r.change, userEvent: "inkwell.block-mode" });
  if (r.firstSave && sourcePath !== null) host.onFirstDraftSaved({ sourcePath, text: view.state.doc.toString() });
}

/** Switch a block through Obsidian's editor (commands). */
export function switchInEditor(editor: Editor, sourcePath: string | null, line: number, mode: BlockMode, host: WritingBlockHost): void {
  const r = modeChange(editor.getValue(), line, mode, host);
  if (!r) return;
  editor.replaceRange(r.change.insert, editor.offsetToPos(r.change.from), editor.offsetToPos(r.change.to));
  if (r.firstSave && sourcePath !== null) host.onFirstDraftSaved({ sourcePath, text: editor.getValue() });
}

/**
 * Switch a block in a note that isn't open for editing (reading view). The block is found again at `line`, and
 * only switched if its writing is still `expected`, so a note that changed meanwhile is never rewritten blindly.
 */
export async function switchInFile(app: App, file: TFile, line: number, expected: string, mode: BlockMode, host: WritingBlockHost): Promise<boolean> {
  let firstSave = false;
  let after = "";
  let moved = false;
  let done = false;
  await app.vault.process(file, (text) => {
    const block = findBlocks(text).find((b) => b.start === line);
    if (!block || block.text !== expected) {
      moved = true;
      return text;
    }
    const r = modeChange(text, line, mode, host);
    if (!r) return text;
    firstSave = r.firstSave;
    done = true;
    after = text.slice(0, r.change.from) + r.change.insert + text.slice(r.change.to);
    return after;
  });
  if (moved) new Notice("This block changed since it was shown. Try again.");
  if (firstSave) host.onFirstDraftSaved({ sourcePath: file.path, text: after });
  return done;
}
