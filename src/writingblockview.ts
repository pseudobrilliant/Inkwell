/**
 * Writing blocks as Obsidian renders them: in reading view, and in Live Preview while the cursor is outside the block.
 * Obsidian joins a callout's lines into one paragraph with line breaks; each line is a paragraph of writing, so split
 * them, and every line gets its own first-line indent (styles.css).
 */
import { TFile, type Plugin } from "obsidian";
import { findBlocks, type BlockMode } from "./writingblocks";
import { renderToolbar, switchInFile, type WritingBlockHost } from "./writingblocktoolbar";

/** Split a paragraph at its <br> line breaks into one paragraph per line. */
function splitAtBreaks(p: HTMLElement): void {
  if (!p.querySelector(":scope > br")) return;
  const parts: Node[][] = [[]];
  for (const node of Array.from(p.childNodes)) {
    if (node.nodeName === "BR") parts.push([]);
    else parts[parts.length - 1]?.push(node);
  }
  const parent = p.parentElement;
  if (!parent) return;
  for (const nodes of parts) {
    const line = parent.createEl("p", { cls: "inkwell-wb-para" });
    // Obsidian adds a newline text node after each <br>; drop the leading one.
    const first = nodes[0];
    if (first?.nodeType === Node.TEXT_NODE) first.textContent = (first.textContent ?? "").replace(/^\n/, "");
    line.append(...nodes);
    p.before(line);
  }
  p.remove();
}

export function registerWritingBlockView(plugin: Plugin, host: WritingBlockHost): void {
  plugin.registerMarkdownPostProcessor((el, ctx) => {
    const callouts = el.matches('.callout[data-callout="writing"]') ? [el] : el.findAll('.callout[data-callout="writing"]');
    for (const callout of callouts) {
      callout.addClass("inkwell-wb");
      for (const p of callout.findAll(".callout-content > p")) splitAtBreaks(p);

      // Reading view: the toolbar goes inside the callout. (In Live Preview the editor draws it, and Obsidian gives
      // no section info here, so nothing is added.)
      const info = ctx.getSectionInfo(el);
      const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
      if (!info || !(file instanceof TFile)) continue;
      const block = findBlocks(info.text).find((b) => b.start === info.lineStart);
      if (!block) continue;
      callout.addClass("inkwell-wb-has-toolbar");
      const draw = (mode: BlockMode) => {
        callout.find(":scope > .inkwell-wb-toolbar")?.remove();
        const bar = renderToolbar(callout, { ...block, mode }, (picked) => {
          void switchInFile(plugin.app, file, block.start, block.text, picked, host).then((done) => {
            if (done) draw(picked);
          });
        });
        callout.prepend(bar);
      };
      draw(block.mode);
    }
  });
}
