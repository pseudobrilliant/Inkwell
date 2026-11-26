import { describe, expect, it } from "vitest";
import { cleanName, createNote, ensureFolder, fmDay, fmStr, moveFile, sectionText, slugWords, stripFrontmatter, uniquePath } from "../src/util";
import { FakeApp } from "./helpers/fake-app";
import type { App } from "obsidian";

const asApp = (a: FakeApp) => a as unknown as App;

describe("cleanName", () => {
  it("removes characters file names can't hold and collapses spaces", () => {
    expect(cleanName('  A/B: "C"?  #tag [x] ^y  ')).toBe("AB C tag x y");
  });
});

describe("slugWords", () => {
  it("takes the first words of the first line", () => {
    expect(slugWords("She opened the door and the sea came in\nsecond line")).toBe("She opened the door and the");
  });
  it("caps the length", () => {
    expect(slugWords("a".repeat(80), 6, 50)).toHaveLength(50);
  });
  it("drops trailing sentence punctuation, so a name never ends in '..md'", () => {
    expect(slugWords("Then the sea came back.")).toBe("Then the sea came back");
    expect(slugWords("Who was there?!")).toBe("Who was there");
    expect(slugWords("Wait…")).toBe("Wait");
  });
  it("is empty for blank text", () => {
    expect(slugWords("   ")).toBe("");
  });
});

describe("stripFrontmatter", () => {
  it("removes a leading frontmatter block only", () => {
    expect(stripFrontmatter("---\na: 1\n---\nBody\n---\nnot frontmatter\n---")).toBe("Body\n---\nnot frontmatter\n---");
  });
  it("leaves text without frontmatter alone", () => {
    expect(stripFrontmatter("Just text")).toBe("Just text");
  });
});

describe("fmStr", () => {
  it("returns strings, numbers and booleans as text", () => {
    expect(fmStr("x")).toBe("x");
    expect(fmStr(3)).toBe("3");
    expect(fmStr(false)).toBe("false");
  });
  it("never returns [object Object] for lists, objects or null", () => {
    expect(fmStr(["a", "b"])).toBe("");
    expect(fmStr({ a: 1 })).toBe("");
    expect(fmStr(null)).toBe("");
    expect(fmStr(undefined)).toBe("");
  });
  it("returns a valid date as ISO text and an invalid one as empty", () => {
    expect(fmStr(new Date("2026-11-25T00:00:00Z"))).toBe("2026-11-25T00:00:00.000Z");
    expect(fmStr(new Date("nope"))).toBe("");
  });
});

describe("fmDay", () => {
  it("reads dates and datetimes", () => {
    expect(fmDay("2026-11-25")).toBe("2026-11-25");
    expect(fmDay("2026-11-25T21:30")).toBe("2026-11-25");
    expect(fmDay("2026-11-25 21:30")).toBe("2026-11-25");
  });
  it("is empty for missing or non-ISO values instead of guessing", () => {
    expect(fmDay(undefined)).toBe("");
    expect(fmDay("")).toBe("");
    expect(fmDay("next Tuesday")).toBe("");
    expect(fmDay("11/25/2026")).toBe("");
    expect(fmDay(["2026-11-25"])).toBe("");
  });
});

describe("sectionText", () => {
  const note = "---\ntype: resource\n---\n# Title\n## Try This\nWrite a poem.\n### Sub\nStill here.\n## Notes\nOther";
  it("returns the text under a ## heading, including ### subsections", () => {
    expect(sectionText(note, "Try This")).toBe("Write a poem.\n### Sub\nStill here.");
  });
  it("matches the heading case-insensitively", () => {
    expect(sectionText(note, "try this")).toBe("Write a poem.\n### Sub\nStill here.");
  });
  it("returns null when there is no such section", () => {
    expect(sectionText(note, "Missing")).toBeNull();
  });
  it("runs to the end of the note for the last section", () => {
    expect(sectionText(note, "Notes")).toBe("Other");
  });
});

describe("vault helpers", () => {
  it("ensureFolder creates nested folders and is idempotent", async () => {
    const app = new FakeApp();
    await ensureFolder(asApp(app), "a/b/c");
    await ensureFolder(asApp(app), "a/b/c");
    expect(app.folder("a/b/c").path).toBe("a/b/c");
  });

  it("ensureFolder refuses a path taken by a file", async () => {
    const app = new FakeApp().seed({ "a/b": "" });
    await expect(ensureFolder(asApp(app), "a/b")).rejects.toThrow(/not a folder/);
  });

  it("uniquePath adds a number when the name is taken", () => {
    const app = new FakeApp().seed({ "f/Note.md": "", "f/Note 2.md": "" });
    expect(uniquePath(asApp(app), "f", "Note")).toBe("f/Note 3.md");
    expect(uniquePath(asApp(app), "f", "Other")).toBe("f/Other.md");
  });

  it("createNote makes the folder and writes required fields over the template's", async () => {
    const app = new FakeApp();
    const file = await createNote(asApp(app), "x/y/Note.md", "---\ntype: wrong\nextra: kept\n---\nBody", { type: "story", status: "idea" });
    expect(file.path).toBe("x/y/Note.md");
    expect(app.fmOfPath("x/y/Note.md")).toEqual({ type: "story", extra: "kept", status: "idea" });
    expect(stripFrontmatter(app.textOf("x/y/Note.md") ?? "")).toBe("Body");
  });

  it("moveFile moves into a new folder without overwriting a file there", async () => {
    const app = new FakeApp().seed({ "a/Note.md": "one", "b/Note.md": "two" });
    await moveFile(asApp(app), app.file("a/Note.md"), "b");
    expect(app.paths()).toEqual(["b/Note 2.md", "b/Note.md"]);
    expect(app.textOf("b/Note 2.md")).toBe("one");
  });
});
