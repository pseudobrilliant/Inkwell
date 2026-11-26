import { describe, expect, it } from "vitest";
import { inInkwellFolders, opts } from "../src/homeblocks";
import { sceneFileName } from "../src/projects";
import { rankPrompts, type Prompt } from "../src/prompts";
import { render } from "../src/templates";
import { DEFAULT_SETTINGS } from "../src/settings";
import type { TFile } from "obsidian";

describe("block options", () => {
  it("reads key: value lines, lower-casing keys", () => {
    expect(opts("Limit: 3\ntitle:  My inbox  \n\nnot an option")).toEqual({ limit: "3", title: "My inbox" });
  });
});

describe("inInkwellFolders", () => {
  const f = DEFAULT_SETTINGS.folders;
  it("matches notes inside Inkwell's folders", () => {
    expect(inInkwellFolders(f, "00 - Inbox/idea.md")).toBe(true);
    expect(inInkwellFolders(f, "03 - Projects/Tide/Scenes/00-10 A.md")).toBe(true);
  });
  it("ignores notes elsewhere and folders that only share a prefix", () => {
    expect(inInkwellFolders(f, "Daily/2026-11-25.md")).toBe(false);
    expect(inInkwellFolders(f, "00 - Inbox Old/idea.md")).toBe(false);
  });
});

describe("templates", () => {
  it("fills {{vars}}, allowing spaces, and blanks unknown ones", () => {
    expect(render("# {{title}}\n{{ logline }}\n{{missing}}!", { title: "Tide", logline: "A boat." })).toBe("# Tide\nA boat.\n!");
  });
});

describe("scene file names", () => {
  it("follows StoryLine's <act>-<sequence> <title>", () => {
    expect(sceneFileName(10, "Low Water")).toBe("00-10 Low Water");
    expect(sceneFileName(5, "A")).toBe("00-05 A");
  });
  it("replaces characters a file name can't hold and caps the length", () => {
    expect(sceneFileName(20, "Who? Me: yes/no")).toBe("00-20 Who- Me- yes-no");
    expect(sceneFileName(10, "x".repeat(100))).toHaveLength(6 + 60);
  });
});

describe("rankPrompts", () => {
  const p = (name: string, used: number, lastUsed: string): Prompt => ({ file: { basename: name } as TFile, used, lastUsed });
  it("puts least used first, then never-used, then oldest", () => {
    const ranked = rankPrompts([p("often", 5, "2026-11-01"), p("recent", 1, "2026-11-20"), p("old", 1, "2026-01-01"), p("never", 0, "")]);
    expect(ranked.map((x) => x.file.basename)).toEqual(["never", "old", "recent", "often"]);
  });
});
