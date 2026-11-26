/**
 * Inkwell's side of writing blocks: what it does around them, kept out of the block code itself
 * (openspec/changes/archive/2026-11-26-writing-blocks/design.md, decision 10). The blocks call this through `WritingBlockHost`.
 */
import type { App, TFile } from "obsidian";
import type InkwellPlugin from "./main";
import { blockAtLine, findBlocks, wrapBody, type BlockMode } from "./writingblocks";
import { switchInEditor, type WritingBlockHost } from "./writingblocktoolbar";
import { newWritingBlock, writingBlockEditor } from "./writingblockeditor";
import { registerWritingBlockView } from "./writingblockview";
import { TypewriterMode } from "./integrations/typewriter-mode";

/**
 * Typewriter Mode, if installed, is on only while the writer is writing in a block.
 * The writing timer is a toolbar tool, and a block's first review stops it (spec writing-timer).
 * Words the writer types in blocks go to Inkwell's word log (spec word-log).
 */
function blockHost(plugin: InkwellPlugin): WritingBlockHost {
  const typewriter = new TypewriterMode(plugin.app);
  return {
    tools: [plugin.timer.tool],
    onWritingInBlock: (writing) => typewriter.writingInBlock(writing),
    onFirstDraftSaved: ({ sourcePath, text }) => void plugin.timer.blockReviewed(sourcePath, text),
    onBlockWords: (sourcePath, words) => plugin.words.add(sourcePath, words),
  };
}

/** Whether a note has a writing block, so its writing counts. */
export async function hasWritingBlock(app: App, file: TFile): Promise<boolean> {
  return findBlocks(await app.vault.cachedRead(file)).length > 0;
}

/**
 * "Put in a writing block": wrap a note's body, below its frontmatter, in one block, so its writing counts from now
 * on (spec writing-blocks, "Writing that won't count"). Written with `vault.process`, which the word log never counts.
 * Returns whether the note changed.
 */
export async function putInWritingBlock(app: App, file: TFile): Promise<boolean> {
  let changed = false;
  await app.vault.process(file, (text) => {
    const next = wrapBody(text);
    if (next === null) return text;
    changed = true;
    return next;
  });
  return changed;
}

const MODE_COMMANDS: { mode: BlockMode; id: string; name: string }[] = [
  { mode: "writing", id: "block-draft-mode", name: "Draft mode" },
  { mode: "review", id: "block-review-mode", name: "Review mode" },
  { mode: "edited", id: "block-edited-mode", name: "Edited mode" },
];

export function registerWritingBlocks(plugin: InkwellPlugin): void {
  const host = blockHost(plugin);
  plugin.registerEditorExtension(writingBlockEditor(host));
  registerWritingBlockView(plugin, host);

  plugin.addCommand({ id: "new-writing-block", name: "New writing block", editorCallback: (editor) => newWritingBlock(editor) });
  for (const { mode, id, name } of MODE_COMMANDS) {
    plugin.addCommand({
      id,
      name,
      editorCheckCallback: (checking, editor, info) => {
        const block = blockAtLine(findBlocks(editor.getValue()), editor.getCursor().line);
        if (!block || block.mode === mode) return false;
        if (!checking) switchInEditor(editor, info.file?.path ?? null, block.start, mode, host);
        return true;
      },
    });
  }
  plugin.registerEvent(
    plugin.app.workspace.on("editor-menu", (menu, editor, info) => {
      menu.addItem((i) => i.setTitle("New writing block").setIcon("pencil-line").onClick(() => newWritingBlock(editor)));
      const block = blockAtLine(findBlocks(editor.getValue()), editor.getCursor().line);
      if (!block) return;
      for (const { mode, name } of MODE_COMMANDS) {
        if (mode !== block.mode) menu.addItem((i) => i.setTitle(name).onClick(() => switchInEditor(editor, info.file?.path ?? null, block.start, mode, host)));
      }
    })
  );
}
