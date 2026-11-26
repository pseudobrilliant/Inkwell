/**
 * The writing block's toolbar, and switching a block's mode from it (or from a command).
 * One toolbar is drawn in both places a block appears: the rendered callout's title, and the header line while
 * editing, so it looks the same in each. What it shows comes from the block type: for the writing block, its modes.
 *
 * Writing blocks don't depend on the rest of Inkwell (design decision 10). The host (Inkwell) passes in what it
 * wants done around a switch, such as the Keep the Rhythm notice, through `WritingBlockHost`.
 */
import { Notice, type App, type Editor, type TFile } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { BLOCK_MODES, findBlocks, setMode, type BlockMode, type TextChange, type WritingBlock } from "./writingblocks";

export interface WritingBlockHost {
  /** Called when a block first leaves Draft mode and its first draft is saved. */
  onFirstDraftSaved(): void;
  /**
   * Called when the writer starts or stops writing in a block: the cursor moves into or out of one in the focused
   * editor (Live Preview), or that editor closes. Called only when the answer changes, for each editor.
   */
  onWritingInBlock(writing: boolean): void;
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

/** Draw a block's toolbar into `container`: its modes, the current one marked. */
export function renderToolbar(container: HTMLElement, block: WritingBlock, onPick: (mode: BlockMode) => void): HTMLElement {
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
export function switchInView(view: EditorView, line: number, mode: BlockMode, host: WritingBlockHost): void {
  const r = modeChange(view.state.doc.toString(), line, mode, host);
  if (!r) return;
  view.dispatch({ changes: r.change, userEvent: "inkwell.block-mode" });
  if (r.firstSave) host.onFirstDraftSaved();
}

/** Switch a block through Obsidian's editor (commands). */
export function switchInEditor(editor: Editor, line: number, mode: BlockMode, host: WritingBlockHost): void {
  const r = modeChange(editor.getValue(), line, mode, host);
  if (!r) return;
  editor.replaceRange(r.change.insert, editor.offsetToPos(r.change.from), editor.offsetToPos(r.change.to));
  if (r.firstSave) host.onFirstDraftSaved();
}

/**
 * Switch a block in a note that isn't open for editing (reading view). The block is found again at `line`, and
 * only switched if its writing is still `expected`, so a note that changed meanwhile is never rewritten blindly.
 */
export async function switchInFile(app: App, file: TFile, line: number, expected: string, mode: BlockMode, host: WritingBlockHost): Promise<boolean> {
  let firstSave = false;
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
    return text.slice(0, r.change.from) + r.change.insert + text.slice(r.change.to);
  });
  if (moved) new Notice("This block changed since it was shown. Try again.");
  if (firstSave) host.onFirstDraftSaved();
  return done;
}
