import { beforeEach, describe, expect, it, vi } from "vitest";
// The stub module itself (the same instance "obsidian" resolves to in tests), for its recorded notices.
import { Notice } from "./helpers/obsidian";

vi.mock("../src/modals", () => ({ askForm: vi.fn(async () => ({ target: "60000" })), pick: vi.fn() }));

import { promoteToLongForm, splitScenes } from "../src/promote";
import { snapshotDraft } from "../src/revisions";
import { storyFromFolder } from "../src/stories";
import { fakePlugin, FakeApp } from "./helpers/fake-app";

describe("splitScenes", () => {
  it("splits at headings and uses them as titles", () => {
    const scenes = splitScenes("# Arrival\nShe came.\n## The Storm\nIt rained.");
    expect(scenes).toEqual([
      { title: "Arrival", text: "She came." },
      { title: "The Storm", text: "It rained." },
    ]);
  });

  it("splits at ***, --- and ___ breaks, naming untitled scenes from their first words", () => {
    const scenes = splitScenes("First part here.\n***\nSecond part here.\n---\nThird.\n___\nFourth.");
    expect(scenes.map((s) => s.title)).toEqual(["First part here", "Second part here", "Third", "Fourth"]);
  });

  it("accepts spaced star breaks", () => {
    expect(splitScenes("One.\n* * *\nTwo.")).toHaveLength(2);
  });

  it("does not split at #### or deeper headings", () => {
    expect(splitScenes("# A\ntext\n#### small\nmore")).toHaveLength(1);
  });

  it("drops empty sections but keeps a titled one with no text", () => {
    const scenes = splitScenes("***\n\n***\n# Empty\n***\nBody.");
    expect(scenes).toEqual([
      { title: "Empty", text: "" },
      { title: "Body", text: "Body." },
    ]);
  });

  it("makes one scene of a draft with no breaks", () => {
    expect(splitScenes("Just one long piece of prose.")).toHaveLength(1);
  });

  it("returns nothing for an empty draft", () => {
    expect(splitScenes("\n\n")).toEqual([]);
  });
});

const STORY = "02 - Stories/Tide";

function storyVault() {
  return new FakeApp().seed({
    [`${STORY}/Tide.md`]: "---\ntype: story\nstatus: drafting\ntarget_wordcount: 3000\n---\n# Tide\nHub notes.",
    [`${STORY}/Tide - Draft.md`]: "---\ntype: draft\nversion: 2\n---\n# Low Water\nThe boat sat.\n***\nThen the sea came back.",
    [`${STORY}/Mara.md`]: "---\ntype: character\n---\nThe captain.",
    [`${STORY}/Harbor.md`]: "---\ntype: place\n---\nOld term for a location.",
    [`${STORY}/Notes/Research.md`]: "Tide tables.",
    [`${STORY}/Archive/Tide - Draft v1.md`]: "---\ntype: draft\nversion: 1\nsnapshot: 2026-11-01\n---\nOld.",
  });
}

describe("promoteToLongForm", () => {
  beforeEach(() => {
    Notice.messages = [];
  });

  it("keeps the original draft and a copy of the hub in Archive before splitting", async () => {
    const plugin = fakePlugin(storyVault());
    const { app } = plugin;
    await promoteToLongForm(plugin, storyFromFolder(plugin, app.folder(STORY)));

    const P = "03 - Projects/Tide";
    expect(app.textOf(`${P}/Archive/Tide - Draft.md`)).toContain("The boat sat.");
    expect(app.textOf(`${P}/Archive/Tide - Short Story Hub.md`)).toContain("Hub notes.");
    expect(app.paths()).toContain(`${P}/Archive/Tide - Draft v1.md`);
  });

  it("splits the draft into numbered StoryLine scenes", async () => {
    const plugin = fakePlugin(storyVault());
    const { app } = plugin;
    await promoteToLongForm(plugin, storyFromFolder(plugin, app.folder(STORY)));

    const scenes = app.paths().filter((p) => p.includes("/Scenes/"));
    expect(scenes).toEqual(["03 - Projects/Tide/Scenes/00-10 Low Water.md", "03 - Projects/Tide/Scenes/00-20 Then the sea came back.md"]);
    expect(app.fmOfPath(scenes[0]!)).toMatchObject({ type: "scene", sequence: 10, status: "draft", title: "Low Water", target_wordcount: 800 });
    expect(app.fmOfPath(scenes[1]!)).toMatchObject({ sequence: 20 });
  });

  it("moves characters and locations into the codex, renaming the old place type", async () => {
    const plugin = fakePlugin(storyVault());
    const { app } = plugin;
    await promoteToLongForm(plugin, storyFromFolder(plugin, app.folder(STORY)));

    expect(app.fmOfPath("03 - Projects/Tide/Codex/Characters/Mara.md")).toMatchObject({ type: "character", project: "[[Tide]]" });
    expect(app.fmOfPath("03 - Projects/Tide/Codex/Locations/Harbor.md")).toMatchObject({ type: "location" });
    expect(app.paths()).toContain("03 - Projects/Tide/Notes/Research.md");
  });

  it("turns the hub into the project note and trashes the empty story folder", async () => {
    const plugin = fakePlugin(storyVault());
    const { app } = plugin;
    await promoteToLongForm(plugin, storyFromFolder(plugin, app.folder(STORY)));

    expect(app.fmOfPath("03 - Projects/Tide/Tide.md")).toMatchObject({ type: "storyline", title: "Tide", target_wordcount: 60000, language: "en" });
    expect(app.trashed).toEqual([STORY]);
    expect(app.paths().some((p) => p.startsWith("02 - Stories/"))).toBe(false);
  });

  it("refuses when a project of that name exists, changing nothing", async () => {
    const plugin = fakePlugin(storyVault().seed({ "03 - Projects/Tide/Tide.md": "taken" }));
    const before = plugin.app.paths();
    await promoteToLongForm(plugin, storyFromFolder(plugin, plugin.app.folder(STORY)));
    expect(plugin.app.paths()).toEqual(before);
    expect(Notice.messages.at(-1)).toMatch(/already exists/);
  });
});

describe("snapshotDraft", () => {
  it("saves the draft to Archive as its version and bumps the working draft", async () => {
    const plugin = fakePlugin(storyVault());
    const { app } = plugin;
    await snapshotDraft(plugin, storyFromFolder(plugin, app.folder(STORY)));

    expect(app.fmOfPath(`${STORY}/Archive/Tide - Draft v2.md`)).toMatchObject({ type: "draft", version: 2 });
    expect(app.textOf(`${STORY}/Archive/Tide - Draft v2.md`)).toContain("The boat sat.");
    expect(app.fmOfPath(`${STORY}/Tide - Draft.md`)).toMatchObject({ version: 3 });
  });
});
