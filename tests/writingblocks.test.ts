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
  breakKinds,
  endsWithBreak,
  shiftEnterAt,
  withLineBreaks,
  lockedRanges,
  writingAt,
  outsideLocked,
  touchesLocked,
  diffSegments,
  plainParagraphs,
  reviewParagraphs,
  type DiffSegment,
  damagesFirstDraft,
  guardedDrafts,
  widenJoin,
  breaksHeader,
  cursorStop,
  keepApart,
  leaveAtEnd,
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

  it("a block with no comment is in Draft mode", () => {
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

  it("enter on an empty last line starts another paragraph", () => {
    // Pressing Enter twice out of habit never throws the writer out of the block.
    expect(press(enterAt, "> [!writing]\n> The door.\n> |\n\nAfter.")).toBe("> [!writing]\n> The door.\n> \n> |\n\nAfter.");
    const reviewedBlock = "> [!writing]\n> The door.\n> |\n\n%% writing-block first-draft review\nA door.\n%%";
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
    // An empty line is left where the block was, so the next keys never land in the heading above.
    expect(press(backspaceAt, "## Work\n> [!writing]\n> |\n\n## Reflection")).toBe("## Work\n|\n\n## Reflection");
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
    expect(press(deleteAt, "> [!writing]\n> Last.|\n\nAfter.")).toBe("> [!writing]\n> Last.|\n\nAfter.");
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
    expect(WRITING_BLOCK.modes.map((m) => m.label)).toEqual(["Draft", "Review", "Edited"]);
  });

  it("picking modes in any order", () => {
    let text = "> [!writing]\n> Draft.";
    for (const mode of ["edited", "writing", "review", "writing", "edited"] as const) {
      text = switchTo(text, mode);
      expect(findBlocks(text)[0]?.mode).toBe(mode);
    }
  });
});

describe("lines Markdown counts as part of the block", () => {
  it("includes text straight after a line of writing, as Obsidian shows it", () => {
    const [b] = findBlocks("> [!writing]\n> One.\nTwo, no prefix.\nThree.\n\nAfter.");
    expect(b?.lines).toEqual(["One.", "Two, no prefix.", "Three."]);
  });

  it("ends at a blank line, a heading, a list or a comment, and after a blank > line", () => {
    for (const next of ["## Reflection", "- item", "%% hint %%", "```"]) {
      expect(findBlocks(`> [!writing]\n> One.\n${next}`)[0]?.lines).toEqual(["One."]);
    }
    expect(findBlocks("> [!writing]\n> One.\n>\nNot in.")[0]?.lines).toEqual(["One.", ""]);
  });

  it("finds the first draft below a block whose last lines have no > (the writer's note)", () => {
    const note = [
      ">[!writing]",
      ">The door was open.",
      "> Second line.",
      "Third line, no prefix.",
      "",
      "%% writing-block first-draft writing",
      "The door was open.",
      "%%",
    ].join("\n");
    const [b] = findBlocks(note);
    expect(b?.lines).toEqual(["The door was open.", "Second line.", "Third line, no prefix."]);
    expect(b?.firstDraft?.text).toBe("The door was open.");
  });
});

describe("guards while editing", () => {
  it("a join takes the next line's > with the line break", () => {
    const text = "> [!writing]\n> One.\n> Two.";
    const two = text.indexOf("> Two.");
    // Deleting just the line break (cursor before the hidden "> ", or a selection ending there).
    expect(widenJoin(text, two - 1, two)).toEqual({ from: two - 1, to: two + 2, insert: "" });
    expect(widenJoin(text, two - 3, two + 1)).toEqual({ from: two - 3, to: two + 2, insert: "" });
    // Deletions that don't end at a line's start are left alone.
    expect(widenJoin(text, two + 2, two + 4)).toEqual({ from: two + 2, to: two + 4, insert: "" });
  });

  it("the kept first draft can't be edited by accident", () => {
    const text = "> [!writing]\n> One.\n\n%% writing-block first-draft review\nOne.\n%%\nAfter.";
    const drafts = guardedDrafts(text);
    const after = text.indexOf("After.");
    const inComment = text.indexOf("One.\n%%");
    // Backspace at the start of the line below joins it onto the closing %%: refused.
    expect(damagesFirstDraft(drafts, after - 1, after, after, after)).toBe(true);
    // Typing on the blank line between block and comment: refused.
    expect(damagesFirstDraft(drafts, text.indexOf("\n\n%%") + 1, text.indexOf("\n\n%%") + 1, 0, 0)).toBe(true);
    // Typing on the line below, or in the writing: fine.
    expect(damagesFirstDraft(drafts, after, after, after, after)).toBe(false);
    expect(damagesFirstDraft(drafts, 16, 16, 16, 16)).toBe(false);
    // With the cursor in the comment, the writer is editing it by hand: allowed.
    expect(damagesFirstDraft(drafts, inComment, inComment + 1, inComment, inComment)).toBe(false);
    // Deleting the whole block with its draft: allowed.
    expect(damagesFirstDraft(drafts, 0, after, 0, after)).toBe(false);
  });
});

/** Apply one edit to a note. */
const edit = (text: string, c: { from: number; to: number; insert: string }) => text.slice(0, c.from) + c.insert + text.slice(c.to);

describe("keeping the block whole", () => {
  it("deleting or typing over a whole paragraph keeps the next one's >", () => {
    // A triple-click selects a paragraph from its line's start through its line break.
    const text = "> [!writing]\n> First.\n> Second.\n> Third.";
    const second = text.indexOf("> Second.");
    const third = text.indexOf("> Third.");
    expect(edit(text, widenJoin(text, second, third))).toBe("> [!writing]\n> First.\n> Third.");
    expect(edit(text, widenJoin(text, second, third, "New."))).toBe("> [!writing]\n> First.\n> New.Third.");
    const first = text.indexOf("> First.");
    expect(findBlocks(edit(text, widenJoin(text, first, second)))[0]?.lines).toEqual(["Second.", "Third."]);
  });

  it("deleting to a paragraph's start keeps its >", () => {
    // Cmd+Backspace mid-line can reach the line's very start, past the hidden "> ".
    const text = "> [!writing]\n> One.\n> Two words.\n> Three.";
    const two = text.indexOf("> Two");
    expect(edit(text, widenJoin(text, two, two + 6))).toBe("> [!writing]\n> One.\n> words.\n> Three.");
    expect(edit(text, widenJoin(text, two, text.indexOf("\n> Three.")))).toBe("> [!writing]\n> One.\n> \n> Three.");
  });

  it("a damaged closing %% means never reviewed, and nothing past it is read", () => {
    const text = [
      "> [!writing]", "> A now.", "", "%% writing-block first-draft review", "A then.", "%%x", "Between.", "",
      "> [!writing]", "> B now.", "", "%% writing-block first-draft review", "B then.", "%%",
    ].join("\n");
    const blocks = findBlocks(text);
    expect(blocks.map((b) => b.text)).toEqual(["A now.", "B now."]);
    expect(blocks[0]?.firstDraft).toBeNull();
    expect(blocks[1]?.firstDraft?.text).toBe("B then.");
  });

  it("the cursor never rests on the hidden header", () => {
    const text = "## Work\n> [!writing]\n> Words.\n\nAfter.";
    const header = text.indexOf("> [!writing]");
    const writing = text.indexOf("Words.");
    // Coming from above, or a click (Obsidian's edit button lands here): into the writing.
    expect(cursorStop(text, header, 2, false)).toBe(writing);
    expect(cursorStop(text, header, text.length, true)).toBe(writing);
    // Left or Up from the first paragraph: out of the block, to the end of the line above.
    expect(cursorStop(text, header, writing, false)).toBe(header - 1);
    // Up from below the block: into its last line.
    expect(cursorStop(text, header, text.indexOf("After."), false)).toBe(text.indexOf("\n\nAfter."));
    // Anywhere else: left alone.
    expect(cursorStop(text, writing + 2, writing, false)).toBeNull();
    expect(cursorStop(text, 3, 0, false)).toBeNull();
  });

  it("edits that would break the header are refused", () => {
    const text = "## Work\n> [!writing]\n> Words.\n\nAfter.";
    const header = text.indexOf("> [!writing]");
    const first = text.indexOf("> Words.");
    // Backspace at the header's start, Delete at the end of the line above, typing before the header.
    expect(breaksHeader(text, header - 1, header, "")).toBe(true);
    expect(breaksHeader(text, header, header, "x")).toBe(true);
    // Joining the first paragraph onto the header.
    expect(breaksHeader(text, first - 1, first + 2, "")).toBe(true);
    // A selection from the text above into the writing.
    expect(breaksHeader(text, 3, first + 4, "")).toBe(true);
    // Fine: typing or Enter at the end of the line above, deleting whole lines above, the whole block, or writing.
    expect(breaksHeader(text, header - 1, header - 1, "\n")).toBe(false);
    expect(breaksHeader(text, 0, header, "")).toBe(false);
    expect(breaksHeader(text, 0, text.indexOf("\n\nAfter."), "")).toBe(false);
    expect(breaksHeader(text, first + 3, first + 3, "x")).toBe(false);
    expect(breaksHeader(text, first, text.indexOf("\n\nAfter."), "")).toBe(false);
  });

  it("the folded first draft is passed over, never opened by moving", () => {
    const text = "> [!writing]\n> Now.\n\n%% writing-block first-draft review\nThen.\n%%\nAfter.";
    const lastEnd = text.indexOf("\n\n%%");
    const open = text.indexOf("%% writing-block");
    const close = text.indexOf("%%\nAfter.") + 2;
    // Down past the block (landing on the fold's edge): below the first draft.
    expect(cursorStop(text, close, lastEnd, false)).toBe(close + 1);
    expect(cursorStop(text, open, lastEnd, false)).toBe(close + 1);
    // Up from below: into the writing's last line. The blank line above the draft isn't a stop either.
    expect(cursorStop(text, close, close + 3, false)).toBe(lastEnd);
    expect(cursorStop(text, lastEnd + 1, close + 3, true)).toBe(lastEnd);
    // Strictly inside the comment (opened by a click on it): left alone, so it can be edited by hand.
    expect(cursorStop(text, open + 5, open + 5, true)).toBeNull();
  });

  it("typing at the edges of a first draft is refused", () => {
    const text = "> [!writing]\n> Now.\n\n%% writing-block first-draft review\nThen.\n%%\nAfter.";
    const drafts = guardedDrafts(text);
    const open = text.indexOf("%% writing-block");
    const close = text.indexOf("%%\nAfter.") + 2;
    expect(damagesFirstDraft(drafts, close, close, close, close, "x")).toBe(true);
    expect(damagesFirstDraft(drafts, open, open, open, open, "x")).toBe(true);
    // Enter at the very end of the draft adds a line below it: fine.
    expect(damagesFirstDraft(drafts, close, close, close, close, "\n")).toBe(false);
  });

  it("the end of a locked block is locked too", () => {
    const note = "Before.\n> [!writing]\n> Revised.\n\n%% writing-block first-draft writing\nFirst.\n%%\nAfter.";
    const ranges = lockedRanges(note);
    const end = ranges[0]!.to;
    expect(touchesLocked(ranges, end, end, "x")).toBe(true);
    expect(touchesLocked(ranges, end, end, "\n")).toBe(false);
    expect(outsideLocked(ranges, end, 3, note.length)).toBe(end + 1);
    expect(outsideLocked(ranges, end, note.length, note.length)).toBe(ranges[0]!.from - 1);
  });

  it("typing straight below a block keeps a blank line between", () => {
    // Text right under a callout line would join the block, so a blank line is kept.
    const text = "> [!writing]\n> Words.\n\n## Reflection";
    const blank = text.indexOf("\n\n## ") + 1;
    expect(keepApart(text, blank, blank, "N")).toEqual({ from: blank, to: blank, insert: "\nN" });
    expect(findBlocks(edit(text, keepApart(text, blank, blank, "Note.")))[0]?.text).toBe("Words.");
    // Elsewhere, and a line break typed there: unchanged.
    expect(keepApart(text, 3, 3, "x")).toEqual({ from: 3, to: 3, insert: "x" });
    expect(keepApart(text, blank, blank, "\n")).toEqual({ from: blank, to: blank, insert: "\n" });
  });

  it("down arrow on the last line of a note leaves the block", () => {
    expect(press(leaveAtEnd, "> [!writing]\n> The en|d.")).toBe("> [!writing]\n> The end.\n\n|");
    const reviewedAtEnd = "> [!writing]\n> Now.|\n\n%% writing-block first-draft review\nThen.\n%%";
    expect(press(leaveAtEnd, reviewedAtEnd)).toBe(reviewedAtEnd.replace("|", "") + "\n|");
    // With a line below the block, the arrow key does its usual job.
    expect(press(leaveAtEnd, "> [!writing]\n> The en|d.\n\nAfter.")).toBeNull();
    expect(press(leaveAtEnd, "> [!writing]\n> On|e.\n> Two.")).toBeNull();
  });
});

const rebuild = (segs: DiffSegment[], keep: DiffSegment["kind"]) => segs.filter((g) => g.kind === "same" || g.kind === keep).map((g) => g.text).join("");

describe("review: what changed since the first draft", () => {
  it("diff marks replaced words as removed then added", () => {
    const segs = diffSegments("I have been here before.", "I have come back before.");
    expect(segs.filter((g) => g.kind !== "same").map((g) => [g.kind, g.text.trim()])).toEqual([
      ["removed", "been here"],
      ["added", "come back"],
    ]);
  });

  it("no changes gives no marks", () => {
    expect(diffSegments("Same text.\nTwo.", "Same text.\nTwo.")).toEqual([{ kind: "same", text: "Same text.\nTwo.", at: 0 }]);
  });

  it("paragraph breaks change the layout without a mark", () => {
    const text = (p: { text: string }[]) => p.map((sp) => sp.text).join("");
    const split = reviewParagraphs(diffSegments("One. Two.", "One.\nTwo."));
    expect(split).toHaveLength(2);
    expect(split.flat().some((sp) => sp.text.includes("¶"))).toBe(false);
    const joined = reviewParagraphs(diffSegments("One.\nTwo.", "One. Two."));
    expect(joined).toHaveLength(1);
    expect(joined.flat().some((sp) => sp.text.includes("¶"))).toBe(false);
    // The removed break leaves nothing behind (the space the writer typed in its place is an added change).
    expect(joined[0]!.filter((sp) => sp.kind === "removed")).toEqual([]);
    expect(text(joined[0]!)).toBe("One. Two.");
  });

  it("rebuilding the first draft from the segments gives it back exactly", () => {
    const cases: [string, string][] = [
      ["I have been here before.\n\nThe door was open.", "I have come back.\nThe door, open, was not.\nNew ending."],
      ["", "All new."],
      ["All gone.", ""],
      ["Curly ‘quotes’ — and dashes.", "Curly “quotes” – and dashes!"],
    ];
    for (const [before, after] of cases) {
      const segs = diffSegments(before, after);
      expect(rebuild(segs, "removed")).toBe(before);
      expect(rebuild(segs, "added")).toBe(after);
      for (const g of segs) if (g.kind !== "removed") expect(after.slice(g.at, g.at + g.text.length)).toBe(g.text);
    }
  });

  it("diffs a long, heavily rewritten block quickly", () => {
    const words = (seed: number) => Array.from({ length: 5000 }, (_, i) => `w${(i * seed) % 997}`).join(" ");
    const before = words(7);
    const after = words(13);
    const t = performance.now();
    const segs = diffSegments(before, after);
    expect(performance.now() - t).toBeLessThan(100);
    expect(rebuild(segs, "removed")).toBe(before);
    expect(rebuild(segs, "added")).toBe(after);
  });

  it("edited shows current text with no marks", () => {
    expect(plainParagraphs("One.\n\nTwo.")).toEqual([[{ kind: "same", text: "One." }], [], [{ kind: "same", text: "Two." }]]);
  });
});

describe("Draft mode after review", () => {
  const note = "Before.\n> [!writing]\n> Revised.\n\n%% writing-block first-draft writing\nFirst.\n%%\nAfter.";

  it("typing into a reviewed block in Draft mode is refused", () => {
    const ranges = lockedRanges(note);
    expect(ranges).toEqual([{ from: 8, to: note.indexOf("%%\nAfter.") + 2 }]);
    const inWriting = note.indexOf("Revised.");
    expect(touchesLocked(ranges, inWriting, inWriting)).toBe(true);
    expect(touchesLocked(ranges, inWriting, inWriting + 3)).toBe(true);
    // Outside the block, and deleting the whole block: fine.
    expect(touchesLocked(ranges, 0, 0)).toBe(false);
    expect(touchesLocked(ranges, note.indexOf("After."), note.indexOf("After."))).toBe(false);
    expect(touchesLocked(ranges, 8, ranges[0]!.to)).toBe(false);
    // Review and Edited blocks, and blocks never reviewed, aren't locked.
    expect(lockedRanges(note.replace("first-draft writing", "first-draft review"))).toEqual([]);
    expect(lockedRanges("> [!writing]\n> Never reviewed.")).toEqual([]);
  });

  it("the cursor moves past a locked block in the direction it was going", () => {
    const ranges = lockedRanges(note);
    const r = ranges[0]!;
    const inside = note.indexOf("Revised.");
    // Coming from above, or a click inside: below the block.
    expect(outsideLocked(ranges, inside, 3, note.length)).toBe(r.to + 1);
    expect(outsideLocked(ranges, inside, inside, note.length)).toBe(r.to + 1);
    // Coming from below: above it.
    expect(outsideLocked(ranges, inside, note.length, note.length)).toBe(r.from - 1);
    // Not inside: nothing to do.
    expect(outsideLocked(ranges, 2, 0, note.length)).toBeNull();
  });
});

describe("Shift+Enter: a line break in the same paragraph", () => {
  it("shift+enter breaks the line and saves a \\ at its end", () => {
    expect(press(shiftEnterAt, "> [!writing]\n> The door was open, and| I walked in.")).toBe(
      "> [!writing]\n> The door was open, and\\\n> | I walked in."
    );
    expect(findBlocks("> [!writing]\n> One,\\\n> two.")[0]?.lines).toEqual(["One,\\", "two."]);
  });

  it("never splits a line between its text and its hidden \\", () => {
    // Cursor at the very end, after the hidden \: Enter and Shift+Enter split before it.
    expect(press(enterAt, "> [!writing]\n> One,\\|\n> two.")).toBe("> [!writing]\n> One,\n> |\\\n> two.");
    expect(press(shiftEnterAt, "> [!writing]\n> One,\\|\n> two.")).toBe("> [!writing]\n> One,\\\n> |\\\n> two.");
  });

  it("joining a line break removes its \\", () => {
    expect(press(backspaceAt, "> [!writing]\n> One,\\\n> |two.")).toBe("> [!writing]\n> One,|two.");
    expect(press(deleteAt, "> [!writing]\n> One,|\\\n> two.")).toBe("> [!writing]\n> One,|two.");
    const text = "> [!writing]\n> One,\\\n> two.";
    const two = text.indexOf("> two.");
    expect(widenJoin(text, two - 1, two)).toEqual({ from: two - 2, to: two + 2, insert: "" });
  });

  it("an even run of backslashes is text, not a line break", () => {
    expect(endsWithBreak("C:\\")).toBe(true);
    expect(endsWithBreak("a literal \\\\")).toBe(false);
    expect(endsWithBreak("none")).toBe(false);
  });

  it("draws continued lines in the same paragraph, without the \\", () => {
    const paras = withLineBreaks(plainParagraphs("One,\\\ntwo.\nNew paragraph."));
    expect(paras.map((p) => p.map((line) => line.map((sp) => sp.text).join("")))).toEqual([["One,", "two."], ["New paragraph."]]);
  });

  it("knows which of Obsidian's line breaks are Shift+Enter breaks", () => {
    const [b] = findBlocks("> [!writing]\n> One,\\\n> two.\n> Three.\n>\n> Four.");
    expect(breakKinds(b!)).toEqual([[true, false], []]);
  });
});

describe("writing in a block", () => {
  it("knows when the cursor is in a block's writing, and not in a locked one", () => {
    const note = "Before.\n> [!writing]\n> Line one.\n> Line two.\n\nAfter.";
    expect(writingAt(note, note.indexOf("Line one."))).toBe(true);
    expect(writingAt(note, note.indexOf("two.") + 4)).toBe(true);
    // Above it, on its header, and below it: not writing.
    expect(writingAt(note, 0)).toBe(false);
    expect(writingAt(note, note.indexOf("[!writing]"))).toBe(false);
    expect(writingAt(note, note.indexOf("After."))).toBe(false);
    // A reviewed block in Draft mode is locked; in Review or Edited the writer can write in it again.
    const reviewed = "> [!writing]\n> Revised.\n\n%% writing-block first-draft writing\nFirst.\n%%";
    expect(writingAt(reviewed, reviewed.indexOf("Revised."))).toBe(false);
    const inReview = reviewed.replace("first-draft writing", "first-draft review");
    expect(writingAt(inReview, inReview.indexOf("Revised."))).toBe(true);
    // The opened first draft is edited by hand, not written in.
    expect(writingAt(inReview, inReview.indexOf("First."))).toBe(false);
  });
});
