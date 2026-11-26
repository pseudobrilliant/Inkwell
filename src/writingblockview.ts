/**
 * Writing blocks as Obsidian renders them: in reading view, and in Live Preview while the cursor is outside the block.
 * Obsidian joins a callout's lines into one paragraph with line breaks; each line is a paragraph of writing, so split
 * them, and every line gets its own first-line indent (styles.css).
 */
import { TFile, type Plugin } from "obsidian";
import { diffSegments, findBlocks, plainParagraphs, reviewParagraphs, type BlockMode, type ReviewSpan, type WritingBlock } from "./writingblocks";
import { renderToolbar, switchInFile, type WritingBlockHost } from "./writingblocktoolbar";

/** What Obsidian rendered in each block's content, kept so Edited (and a block never reviewed) can show it again. */
const obsidianContent = new WeakMap<HTMLElement, Node[]>();

/**
 * Draw a rendered block's text for its mode: the changes since the first draft (Review), the first draft itself
 * (Draft, once reviewed), or Obsidian's own rendering of the current text (Edited, or never reviewed).
 * Obsidian doesn't redraw a callout when only the comment below it changes, so this is called on every mode switch.
 */
export function drawBlockBody(callout: HTMLElement, block: WritingBlock): void {
  const content = callout.querySelector<HTMLElement>(":scope > .callout-content");
  if (!content) return;
  if (!obsidianContent.has(content)) obsidianContent.set(content, Array.from(content.childNodes));
  const fd = block.firstDraft;
  let paras: ReviewSpan[][] | null = null;
  if (fd && block.mode === "review") paras = reviewParagraphs(diffSegments(fd.text, block.text));
  else if (fd && block.mode === "writing") paras = plainParagraphs(fd.text);
  callout.toggleClass("inkwell-wb-locked", !!fd && block.mode === "writing");
  callout.toggleClass("inkwell-wb-reviewing", !!fd && block.mode === "review");
  content.empty();
  if (!paras) {
    content.append(...(obsidianContent.get(content) ?? []));
    return;
  }
  for (const spans of paras) {
    const p = content.createEl("p", { cls: "inkwell-wb-para" });
    if (!spans.length) p.addClass("inkwell-wb-blank");
    for (const sp of spans) {
      if (sp.kind === "same") p.appendText(sp.text);
      else p.createSpan({ cls: `inkwell-wb-${sp.kind}`, text: sp.text });
    }
  }
}

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
        drawBlockBody(callout, { ...block, mode });
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
