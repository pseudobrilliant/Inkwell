/**
 * Writing blocks as Obsidian renders them: in reading view, and in Live Preview while the cursor is outside the block.
 * Obsidian joins a callout's lines into one paragraph with line breaks; each line is a paragraph of writing, so split
 * them, and every line gets its own first-line indent (styles.css).
 */
import type { Plugin } from "obsidian";

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

export function registerWritingBlockView(plugin: Plugin): void {
  plugin.registerMarkdownPostProcessor((el) => {
    const callouts = el.matches('.callout[data-callout="writing"]') ? [el] : el.findAll('.callout[data-callout="writing"]');
    for (const callout of callouts) {
      callout.addClass("inkwell-wb");
      for (const p of callout.findAll(".callout-content > p")) {
        splitAtBreaks(p);
      }
    }
  });
}
