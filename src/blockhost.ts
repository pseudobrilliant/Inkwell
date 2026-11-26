/**
 * Inkwell's side of writing blocks: what it does around them, kept out of the block code itself
 * (openspec/changes/writing-blocks/design.md, decision 10). The blocks call this through `WritingBlockHost`.
 */
import { Notice } from "obsidian";
import type InkwellPlugin from "./main";
import { blockAtLine, findBlocks, type BlockMode } from "./writingblocks";
import { switchInEditor, type WritingBlockHost } from "./writingblocktoolbar";
import { newWritingBlock, writingBlockEditor } from "./writingblockeditor";
import { registerWritingBlockView } from "./writingblockview";
import { TypewriterMode } from "./integrations/typewriter-mode";

/**
 * Keep the Rhythm counts comments unless told not to; the first draft lives in one. Inkwell never changes KTR's settings.
 * Typewriter Mode, if installed, is on only while the writer is writing in a block.
 */
function blockHost(plugin: InkwellPlugin): WritingBlockHost {
  const typewriter = new TypewriterMode(plugin.app);
  return {
    onWritingInBlock: (writing) => typewriter.writingInBlock(writing),
    onFirstDraftSaved: () => {
      void plugin.ktr.ignoresComments().then((ignored) => {
        if (ignored === false) {
          new Notice(
            "Your first draft is kept in a hidden comment, which Keep the Rhythm counts as new words. To stop that, turn on its setting to not count comments.",
            12_000
          );
        }
      });
    },
  };
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
      editorCheckCallback: (checking, editor) => {
        const block = blockAtLine(findBlocks(editor.getValue()), editor.getCursor().line);
        if (!block || block.mode === mode) return false;
        if (!checking) switchInEditor(editor, block.start, mode, host);
        return true;
      },
    });
  }
  plugin.registerEvent(
    plugin.app.workspace.on("editor-menu", (menu, editor) => {
      menu.addItem((i) => i.setTitle("New writing block").setIcon("pencil-line").onClick(() => newWritingBlock(editor)));
      const block = blockAtLine(findBlocks(editor.getValue()), editor.getCursor().line);
      if (!block) return;
      for (const { mode, name } of MODE_COMMANDS) {
        if (mode !== block.mode) menu.addItem((i) => i.setTitle(name).onClick(() => switchInEditor(editor, block.start, mode, host)));
      }
    })
  );
}
