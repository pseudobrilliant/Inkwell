import { describe, expect, it } from "vitest";
import {
  backspaceAt,
  blockAtLine,
  convertTabbed,
  deleteAt,
  emptyBlock,
  enterAt,
  findBlocks,
  newBlockAt,
  quotePasted,
  setMode,
  tabbedRunAt,
  unwrapBlocks,
  wrapLines,
  type BlockMode,
  type KeyEdit,
} from "../src/writingblocks";
import { blockTypeOf, WRITING_BLOCK } from "../src/writingblocktoolbar";

const reviewed = (mode = "review") =>
  ["> [!writing] Opening", "> I have come back before.", "", `%% writing-block first-draft ${mode}`, "I have been here before.", "%%"].join("\n");

describe("finding writing blocks", () => {
  it("finds a writing callout and its text", () => {
    const [b, ...rest] = findBlocks("## Work\n> [!writing] Opening\n> The chapel door had never had a lock.\n\n## Reflection");
    expect(rest).toEqual([]);
    expect(b).toMatchObject({ start: 1, end: 2, title: "Opening", text: "The chapel door had never had a lock." });
  });

  it("finds two blocks, each with its own mode", () => {
    const blocks = findBlocks(`${reviewed("edited")}\n\nBetween them.\n\n> [!writing]\n> Second block.`);
    expect(blocks.map((b) => [b.text, b.mode])).toEqual([
      ["I have come back before.", "edited"],
      ["Second block.", "writing"],
    ]);
  });

  it("a block with no comment is in Writing mode", () => {
    const [b] = findBlocks("> [!writing]\n> Just written.");
    expect(b?.mode).toBe("writing");
    expect(b?.firstDraft).toBeNull();
  });

  it("a missing or unreadable comment means never reviewed", () => {
    const noBlank = reviewed().replace("\n\n%%", "\n%%");
    const wrongOpening = reviewed().replace("first-draft review", "first draft review");
    const unclosed = reviewed().replace(/\n%%$/, "");
    for (const text of [noBlank, wrongOpening, unclosed]) {
      const [b] = findBlocks(text);
      expect(b?.firstDraft).toBeNull();
      expect(b?.mode).toBe("writing");
    }
  });

  it("reads the first draft and mode from the comment below the block", () => {
    const [b] = findBlocks(reviewed());
    expect(b?.firstDraft).toEqual({ start: 3, end: 5, mode: "review", text: "I have been here before." });
  });

  it("keeps paragraph lines and blank lines, without their > prefix", () => {
    const [b] = findBlocks("> [!writing]\n> One.\n>\n> Two.\r\n>Three.");
    expect(b?.lines).toEqual(["One.", "", "Two.", "Three."]);
  });

  it("ignores other callouts, and writing headers in code or frontmatter", () => {
    const text = "---\nnote: |\n> [!writing]\n---\n> [!note]\n> Not writing.\n```\n> [!writing]\n```\n> [!WRITING|freewrite]- Folded\n> Real.";
    const blocks = findBlocks(text);
    expect(blocks.map((b) => [b.title, b.text])).toEqual([["Folded", "Real."]]);
  });

  it("finds the block a line belongs to, including its comment", () => {
    const blocks = findBlocks(`Before.\n${reviewed()}\nAfter.`);
    expect(blockAtLine(blocks, 0)).toBeNull();
    expect(blockAtLine(blocks, 1)?.start).toBe(1);
    expect(blockAtLine(blocks, 6)?.start).toBe(1);
    expect(blockAtLine(blocks, 7)).toBeNull();
  });
});

describe("making writing blocks", () => {
  it("inserts an empty block with the cursor on its line", () => {
    expect(emptyBlock()).toEqual(["> [!writing]", "> "]);
    expect(findBlocks(emptyBlock().join("\n"))[0]?.text).toBe("");
    // On a blank line: the block replaces it, and a blank line keeps the next paragraph out.
    expect(newBlockAt(["## Work", "", "## Reflection"], { fromLine: 1, toLine: 1, empty: true })).toEqual({
      from: 1,
      to: 1,
      lines: ["> [!writing]", "> ", ""],
      cursorLine: 1,
      cursorCh: 2,
    });
    // On a line with text: the block goes below it.
    expect(newBlockAt(["Some prose."], { fromLine: 0, toLine: 0, empty: true })).toMatchObject({ from: 1, to: 0, lines: ["", "> [!writing]", "> "], cursorLine: 2 });
  });

  it("new writing block wraps a selection or converts the tabbed run under the cursor", () => {
    const lines = ["Intro.", "\tFirst.", "\tSecond.", "Outro."];
    expect(newBlockAt(lines, { fromLine: 2, toLine: 2, empty: true })).toMatchObject({
      from: 1,
      to: 2,
      lines: ["> [!writing]", "> First.", "> Second.", ""],
    });
    expect(newBlockAt(lines, { fromLine: 0, toLine: 0, empty: false })).toMatchObject({ from: 0, to: 0, lines: ["> [!writing]", "> Intro.", ""] });
  });

  it("wraps a selection, keeping words and paragraphs", () => {
    const block = wrapLines(["", "First paragraph here.", "", "Second paragraph.", ""]);
    expect(block).toEqual(["> [!writing]", "> First paragraph here.", ">", "> Second paragraph."]);
    expect(findBlocks(block.join("\n"))[0]?.lines).toEqual(["First paragraph here.", "", "Second paragraph."]);
  });

  it("converts tab-indented lines into a block", () => {
    const lines = ["## Work", "\tIt has been a long time.", "\t\tI keep walking.", "", "## Reflection"];
    const run = tabbedRunAt(lines, 2);
    expect(run).toEqual({ start: 1, end: 2 });
    expect(tabbedRunAt(lines, 0)).toBeNull();
    const block = convertTabbed(lines.slice(run!.start, run!.end + 1));
    expect(block).toEqual(["> [!writing]", "> It has been a long time.", "> I keep walking."]);
  });
});

describe("unwrapBlocks", () => {
  it("turns each block into plain paragraphs and drops its first draft", () => {
    const text = `## Work\n${reviewed()}\n\n> [!writing]\n> Second.\n## Reflection\nDone.`;
    expect(unwrapBlocks(text)).toBe("## Work\nI have come back before.\n\nSecond.\n## Reflection\nDone.");
  });

  it("leaves a note with no blocks unchanged", () => {
    const text = "> [!note]\n> Hint.\n\nProse.";
    expect(unwrapBlocks(text)).toBe(text);
  });
});

/** Apply a key edit to text whose cursor is marked with |, and mark the new cursor the same way. */
function press(key: (text: string, pos: number) => KeyEdit | null, marked: string): string | null {
  const pos = marked.indexOf("|");
  const text = marked.replace("|", "");
  const edit = key(text, pos);
  if (!edit) return null;
  let out = text;
  for (const c of [...edit.changes].sort((a, b) => b.from - a.from)) out = out.slice(0, c.from) + c.insert + out.slice(c.to);
  return out.slice(0, edit.cursor) + "|" + out.slice(edit.cursor);
}

describe("keys inside a block", () => {
  it("enter starts a new paragraph in the block", () => {
    expect(press(enterAt, "> [!writing]\n> The door|was open.")).toBe("> [!writing]\n> The door\n> |was open.");
    expect(press(enterAt, "> [!writing]\n> The door was open.|\nAfter.")).toBe("> [!writing]\n> The door was open.\n> |\nAfter.");
  });

  it("enter on an empty last line leaves the block", () => {
    expect(press(enterAt, "> [!writing]\n> The door.\n> |\nAfter.")).toBe("> [!writing]\n> The door.\n|\nAfter.");
    const reviewedBlock = "> [!writing]\n> The door.\n> |\n\n%% writing-block first-draft review\nA door.\n%%";
    expect(press(enterAt, reviewedBlock)).toBe("> [!writing]\n> The door.\n\n%% writing-block first-draft review\nA door.\n%%\n|");
    expect(findBlocks(press(enterAt, reviewedBlock)!.replace("|", ""))[0]?.firstDraft?.text).toBe("A door.");
  });

  it("enter on a block's only empty line starts a paragraph instead of leaving", () => {
    expect(press(enterAt, "> [!writing]\n> |")).toBe("> [!writing]\n> \n> |");
  });

  it("backspace at a paragraph's start joins it to the one before", () => {
    expect(press(backspaceAt, "> [!writing]\n> One.\n> |Two.")).toBe("> [!writing]\n> One.|Two.");
    expect(press(backspaceAt, "> [!writing]\n> One.\n>|")).toBe("> [!writing]\n> One.|");
  });

  it("backspace on the only empty line removes the block", () => {
    expect(press(backspaceAt, "Before.\n> [!writing]\n> |\nAfter.")).toBe("Before.|\nAfter.");
    expect(press(backspaceAt, "> [!writing]\n> |")).toBe("|");
  });

  it("backspace at the first paragraph's start never deletes into the header", () => {
    expect(press(backspaceAt, "> [!writing]\n> |One.")).toBe("> [!writing]\n> |One.");
    const reviewedEmpty = "> [!writing]\n> |\n\n%% writing-block first-draft review\nA door.\n%%";
    expect(press(backspaceAt, reviewedEmpty)).toBe(reviewedEmpty);
  });

  it("leaves keys mid-line and outside blocks to the editor", () => {
    expect(press(backspaceAt, "> [!writing]\n> On|e.")).toBeNull();
    expect(press(enterAt, "Plain |prose.")).toBeNull();
    expect(press(enterAt, "> [!note]\n> A |hint.")).toBeNull();
  });

  it("delete at a paragraph's end joins the next one", () => {
    expect(press(deleteAt, "> [!writing]\n> One.|\n> Two.")).toBe("> [!writing]\n> One.|Two.");
    expect(press(deleteAt, "> [!writing]\n> Last.|\nAfter.")).toBe("> [!writing]\n> Last.|\nAfter.");
  });

  it("quotes every new line of pasted text", () => {
    expect(quotePasted("One.\r\nTwo.\nThree.")).toBe("One.\n> Two.\n> Three.");
    expect(quotePasted("One line.")).toBe("One line.");
  });
});

/** Switch the first block (or the nth) to a mode and return the new note text, or the refusal. */
function switchTo(text: string, mode: BlockMode, n = 0): string {
  const block = findBlocks(text)[n];
  if (!block) throw new Error("no block");
  const r = setMode(text, block, mode);
  if ("refused" in r) return `refused: ${r.refused}`;
  if ("unchanged" in r) return text;
  return text.slice(0, r.change.from) + r.change.insert + text.slice(r.change.to);
}

describe("modes and the first draft", () => {
  const written = "## Work\n> [!writing]\n> I have been here before.\n\n## Reflection";

  it("first review saves the text as the first draft below the block", () => {
    expect(switchTo(written, "review")).toBe(
      "## Work\n> [!writing]\n> I have been here before.\n\n%% writing-block first-draft review\nI have been here before.\n%%\n\n## Reflection"
    );
    const [b] = findBlocks(switchTo(written, "review"));
    expect(b).toMatchObject({ mode: "review", text: "I have been here before.", firstDraft: { text: "I have been here before." } });
  });

  it("going straight to Edited also keeps the first draft", () => {
    expect(findBlocks(switchTo(written, "edited"))[0]?.firstDraft).toMatchObject({ mode: "edited", text: "I have been here before." });
    expect(switchTo(written, "writing")).toBe(written);
  });

  it("switching modes changes only the mode word", () => {
    const reviewedText = switchTo(written, "review");
    const edited = switchTo(reviewedText, "edited");
    expect(edited).toBe(reviewedText.replace("first-draft review", "first-draft edited"));
    expect(switchTo(edited, "edited")).toBe(edited);
  });

  it("the first draft never changes across mode switches", () => {
    let text = switchTo(written, "review").replace("> I have been here before.", "> I have come back.");
    for (const mode of ["edited", "writing", "review", "edited", "writing"] as const) text = switchTo(text, mode);
    expect(findBlocks(text)[0]).toMatchObject({ text: "I have come back.", mode: "writing", firstDraft: { text: "I have been here before." } });
  });

  it("each block keeps its own mode", () => {
    const two = `${written}\n\n> [!writing]\n> Second.\n`;
    const text = switchTo(switchTo(two, "review", 0), "edited", 1);
    expect(findBlocks(text).map((b) => b.mode)).toEqual(["review", "edited"]);
    expect(findBlocks(switchTo(text, "writing", 0)).map((b) => b.mode)).toEqual(["writing", "edited"]);
  });

  it("refuses review when the writing contains %%", () => {
    const withMarks = "> [!writing]\n> Fifty %% off.";
    expect(switchTo(withMarks, "review")).toMatch(/^refused: .*%%/);
  });

  it("keeps blank lines and paragraphs in the first draft", () => {
    const text = switchTo("> [!writing]\n> One.\n>\n> Two.", "review");
    expect(findBlocks(text)[0]?.firstDraft?.text).toBe("One.\n\nTwo.");
  });
});

describe("the block toolbar", () => {
  it("a writing callout's type defaults to the writing block", () => {
    for (const header of ["> [!writing]", "> [!writing|freewrite] Later types"]) {
      const block = findBlocks(`${header}\n> Text.`)[0]!;
      expect(blockTypeOf(block)).toBe(WRITING_BLOCK);
    }
    expect(WRITING_BLOCK.modes.map((m) => m.label)).toEqual(["Writing", "Review", "Edited"]);
  });

  it("picking modes in any order", () => {
    let text = "> [!writing]\n> Draft.";
    for (const mode of ["edited", "writing", "review", "writing", "edited"] as const) {
      text = switchTo(text, mode);
      expect(findBlocks(text)[0]?.mode).toBe(mode);
    }
  });
});
