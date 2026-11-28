import { describe, expect, it } from "vitest";
import { inInkwellFolders, opts } from "../src/homeblocks";
import { ensureTodaysJournal } from "../src/journal";
import { createScene, projectFromFolder, sceneFileName } from "../src/projects";
import { createShortStory } from "../src/stories";
import { fakePlugin, FakeApp } from "./helpers/fake-app";
import { hasWritingBlock, putInWritingBlock } from "../src/blockhost";
import { rankPrompts, type Prompt } from "../src/prompts";
import { BUILTIN_TEMPLATES, render } from "../src/templates";
import { findBlocks } from "../src/writingblocks";
import { DEFAULT_SETTINGS } from "../src/settings";
import type { App, TFile } from "obsidian";

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

  it("the built-in exercise template starts Work with a timed revision block and Reflection with a timed free-write block", () => {
    const blocks = findBlocks(BUILTIN_TEMPLATES.exercise);
    const lines = BUILTIN_TEMPLATES.exercise.split("\n");
    expect(blocks.map((b) => [lines[b.start - 1], b.type, b.timer, b.text])).toEqual([
      ["## Work", "revision", true, ""],
      ["## Reflection", "freewrite", true, ""],
    ]);
  });
});

describe("new notes start with a writing block", () => {
  const empty = (text: string | undefined) => findBlocks(text ?? "").map((b) => [b.text, b.firstDraft, b.type]);

  it("a new story draft holds an empty writing block", async () => {
    const plugin = fakePlugin();
    await createShortStory(plugin, { title: "Tide", logline: "", genre: "", target: 0 }, { open: false });
    expect(empty(plugin.app.textOf("02 - Stories/Tide/Tide - Draft.md"))).toEqual([["", null, "revision"]]);
  });

  it("a new scene's body is an empty writing block, unless it's given one", async () => {
    const app = new FakeApp().seed({ "03 - Projects/Low/Low.md": "---\ntype: storyline\n---\n" });
    const plugin = fakePlugin(app);
    const project = projectFromFolder(plugin, app.folder("03 - Projects/Low"))!;
    const scene = await createScene(plugin, project, "Arrival", { open: false });
    expect(empty(app.textOf(scene.path))).toEqual([["", null, "revision"]]);
    const given = await createScene(plugin, project, "Storm", { body: "It rained.", open: false });
    expect(app.textOf(given.path)).toMatch(/\nIt rained\.\n$/);
  });

  it("today's journal holds an empty writing block and no ktr-entries block", async () => {
    const plugin = fakePlugin();
    const file = await ensureTodaysJournal(plugin);
    const text = plugin.app.textOf(file.path);
    expect(empty(text)).toEqual([["", null, "freewrite"]]);
    expect(text).toMatch(/\n## Daily Goals\n- \n\n## Ideas, Observations, Reflections\n\n\n## Journal Notes\n\n> \[!writing\]\n> \n\n## Writing\n\n## Words Written today\n```inkwell-entries\n```\n$/);
    expect(text).not.toMatch(/ktr-/);
  });
});

const asApp = (a: FakeApp) => a as unknown as App;

describe("writing that won't count", () => {
  const DRAFT = "02 - Stories/Tide/Tide - Draft.md";
  const fm = "---\ntype: draft\nversion: 2\n---\n";
  const plain = fm + "The boat sat.\n\nThen the sea came back.\n\nIt was low tide.\n";

  it("a draft without a block is found, and one with a block isn't", async () => {
    const app = new FakeApp().seed({ [DRAFT]: plain, "b.md": "> [!writing]\n> Counted.\n" });
    expect(await hasWritingBlock(asApp(app), app.file(DRAFT))).toBe(false);
    expect(await hasWritingBlock(asApp(app), app.file("b.md"))).toBe(true);
  });

  it("putting a draft in a block keeps its paragraphs and frontmatter, and logs nothing", async () => {
    const plugin = fakePlugin(new FakeApp().seed({ [DRAFT]: plain }));
    const { app } = plugin;
    expect(await putInWritingBlock(asApp(app), app.file(DRAFT))).toBe(true);
    const text = app.textOf(DRAFT) ?? "";
    expect(text.startsWith(fm)).toBe(true);
    expect(findBlocks(text).map((b) => [b.type, b.text])).toEqual([["revision", "The boat sat.\n\nThen the sea came back.\n\nIt was low tide."]]);
    // A second time changes nothing.
    expect(await putInWritingBlock(asApp(app), app.file(DRAFT))).toBe(false);
    await plugin.words.store.flush();
    expect(await plugin.words.words(() => true, "0000-00-00")).toBe(0);
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
