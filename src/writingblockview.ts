/**
 * Writing blocks as Obsidian renders them: in reading view, and in Live Preview while the cursor is outside the block.
 * Obsidian joins a callout's lines into one paragraph with line breaks; each line is a paragraph of writing, so split
 * them, and every line gets its own first-line indent (styles.css).
 */
import { TFile, type Plugin } from "obsidian";
import {
  breakKinds,
  diffSegments,
  findBlocks,
  plainParagraphs,
  reviewParagraphs,
  withLineBreaks,
  type BlockMode,
  type ReviewSpan,
  type WritingBlock,
} from "./writingblocks";
import { renderToolbar, switchInFile, type WritingBlockHost } from "./writingblocktoolbar";

/** Obsidian's rendering of each block's content, split into paragraphs, set aside while Inkwell draws its own. */
const obsidianContent = new WeakMap<HTMLElement, Node[]>();

/**
 * Split Obsidian's paragraphs at their line breaks: each line of writing is its own paragraph (with its own indent),
 * except a Shift+Enter line, which stays in its paragraph. `kinds` says which is which, per paragraph; without it,
 * every break starts a paragraph.
 */
function splitParagraphs(content: HTMLElement, kinds: boolean[][] | null): void {
  const paras = Array.from(content.querySelectorAll<HTMLElement>(":scope > p"));
  paras.forEach((p, index) => {
    const brs = Array.from(p.childNodes).filter((n) => n.nodeName === "BR");
    if (!brs.length) return;
    const k = kinds?.[index];
    const lineBreaks = k && k.length === brs.length ? k : brs.map(() => false);
    const parent = p.parentElement;
    if (!parent) return;
    let line = parent.createEl("p", { cls: "inkwell-wb-para" });
    p.before(line);
    let b = 0;
    for (const node of Array.from(p.childNodes)) {
      if (node.nodeName !== "BR") {
        line.append(node);
        continue;
      }
      if (lineBreaks[b++]) {
        line.append(node);
        continue;
      }
      // Obsidian adds a newline text node after each <br>; the next paragraph doesn't need it.
      const next = node.nextSibling;
      if (next?.nodeType === Node.TEXT_NODE) next.textContent = (next.textContent ?? "").replace(/^\n/, "");
      line = parent.createEl("p", { cls: "inkwell-wb-para" });
      p.before(line);
    }
    p.remove();
  });
}

/**
 * Draw a rendered block's text for its mode: the changes since the first draft (Review), the first draft itself
 * (Draft, once reviewed), or Obsidian's own rendering of the current text (Edited, or never reviewed).
 * Obsidian doesn't redraw a callout when only the comment below it changes, so this is called on every mode switch.
 * `block` is null when the block's source isn't known: Obsidian's rendering is then split without line-break info.
 */
export function drawBlockBody(callout: HTMLElement, block: WritingBlock | null): void {
  const content = callout.querySelector<HTMLElement>(":scope > .callout-content");
  if (!content) return;
  let kept = obsidianContent.get(content);
  if (!kept) {
    splitParagraphs(content, block ? breakKinds(block) : null);
    kept = Array.from(content.childNodes);
    obsidianContent.set(content, kept);
  }
  const fd = block?.firstDraft;
  let paras: ReviewSpan[][] | null = null;
  if (block && fd && block.mode === "review") paras = reviewParagraphs(diffSegments(fd.text, block.text));
  else if (block && fd && block.mode === "writing") paras = plainParagraphs(fd.text);
  callout.toggleClass("inkwell-wb-locked", !!fd && block?.mode === "writing");
  callout.toggleClass("inkwell-wb-reviewing", !!fd && block?.mode === "review");
  content.empty();
  if (!paras) {
    content.append(...kept);
    return;
  }
  for (const lines of withLineBreaks(paras)) {
    const p = content.createEl("p", { cls: "inkwell-wb-para" });
    if (lines.every((l) => !l.length)) p.addClass("inkwell-wb-blank");
    lines.forEach((spans, i) => {
      if (i > 0) p.createEl("br");
      for (const sp of spans) {
        if (sp.kind === "same") p.appendText(sp.text);
        else p.createSpan({ cls: `inkwell-wb-${sp.kind}`, text: sp.text });
      }
    });
  }
}

export function registerWritingBlockView(plugin: Plugin, host: WritingBlockHost): void {
  plugin.registerMarkdownPostProcessor((el, ctx) => {
    const callouts = el.matches('.callout[data-callout="writing"]') ? [el] : el.findAll('.callout[data-callout="writing"]');
    for (const callout of callouts) {
      callout.addClass("inkwell-wb");

      // Reading view: the toolbar goes inside the callout. (In Live Preview the editor draws it, and Obsidian gives
      // no section info here, so nothing is added.)
      const info = ctx.getSectionInfo(el);
      const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
      const block = info ? findBlocks(info.text).find((b) => b.start === info.lineStart) : undefined;
      // In Live Preview the editor draws the block (it knows the source); elsewhere without a source, just split lines.
      if (!info || !block || !(file instanceof TFile)) {
        // Checked once the callout is on the page: before that, a Live Preview callout isn't inside the editor yet.
        window.setTimeout(() => {
          if (!callout.closest(".markdown-source-view")) drawBlockBody(callout, null);
        }, 0);
        continue;
      }
      callout.addClass("inkwell-wb-has-toolbar");
      const draw = (mode: BlockMode) => {
        callout.find(":scope > .inkwell-wb-toolbar")?.remove();
        drawBlockBody(callout, { ...block, mode });
        const bar = renderToolbar(
          callout,
          { ...block, mode },
          (picked) => {
            void switchInFile(plugin.app, file, block.start, block.text, picked, host).then((done) => {
              if (done) draw(picked);
            });
          },
          { sourcePath: ctx.sourcePath, tools: host.tools }
        );
        callout.prepend(bar);
      };
      draw(block.mode);
    }
  });
}
