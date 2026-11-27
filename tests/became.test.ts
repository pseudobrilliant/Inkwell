import { describe, expect, it, vi } from "vitest";

vi.mock("../src/modals", () => ({
  askForm: vi.fn(async () => ({ title: "Low Tide", logline: "", genre: "", target: "" })),
  pick: vi.fn(),
}));

import { exerciseBecameStory, workSection } from "../src/became";
import { findBlocks } from "../src/writingblocks";
import { fakePlugin, FakeApp } from "./helpers/fake-app";

const note = (body: string) => `---\ntype: exercise\n---\n${body}`;

describe("workSection", () => {
  it("returns the Work section, ending at the next # or ## heading but not ###", () => {
    expect(workSection(note("## Prompt\nA door.\n## Work\nThe door.\n### Aside\nStill work.\n## Reflection\nDone."))).toBe(
      "The door.\n### Aside\nStill work."
    );
    expect(workSection(note("## Work\nThe door.\n# Next\nNot work."))).toBe("The door.");
  });

  it("returns the whole body when there is no Work section", () => {
    expect(workSection(note("Just prose.\nMore prose."))).toBe("Just prose.\nMore prose.");
  });

  it("returns an empty string for an empty Work section", () => {
    expect(workSection(note("## Work\n\n## Reflection\nDone."))).toBe("");
  });

  it("reads Work to the end of the note when it is the last section", () => {
    expect(workSection(note("## Prompt\nA door.\n## Work\nThe door.\nIt opened."))).toBe("The door.\nIt opened.");
  });

  it("ends the section at a ## line inside a comment", () => {
    expect(workSection(note("## Work\nThe door.\n%% kept\n## Not a heading\n%%\nAfter."))).toBe("The door.\n%% kept");
  });
});

describe("exerciseBecameStory", () => {
  const EX = "01 - Practice/Exercises/Writing/2026-11-25 Low Tide.md";
  const body = note("## Prompt\nThe sea.\n## Work\nThe boat sat.\n\nThen the sea came back.\n## Reflection\nGood.");

  it("copies the Work section into a new story's draft, leaving the exercise unchanged but for became", async () => {
    const app = new FakeApp().seed({ [EX]: body });
    const plugin = fakePlugin(app);
    await exerciseBecameStory(plugin, app.file(EX));

    const draft = app.textOf("02 - Stories/Low Tide/Low Tide - Draft.md") ?? "";
    expect(findBlocks(draft).map((b) => b.text)).toEqual(["The boat sat.\n\nThen the sea came back."]);
    expect(draft).not.toContain("Good.");
    expect(app.fmOfPath("02 - Stories/Low Tide/Low Tide.md")).toMatchObject({ type: "story", from: "[[2026-11-25 Low Tide]]" });
    expect(app.fmOfPath(EX)).toMatchObject({ type: "exercise", became: "[[Low Tide]]" });
    expect(app.textOf(EX)?.replace(/^---[\s\S]*?---\n/, "")).toBe(body.replace(/^---[\s\S]*?---\n/, ""));
  });

  it("a story starts from the block's current text", async () => {
    const withBlock = note(
      "## Work\n> [!writing]\n> The boat came back.\n> Then the sea.\n\n%% writing-block first-draft edited\nThe boat sat.\n***\nOld ending.\n%%\n\n## Reflection\nGood."
    );
    expect(workSection(withBlock)).toBe("The boat came back.\nThen the sea.");
    const app = new FakeApp().seed({ [EX]: withBlock });
    await exerciseBecameStory(fakePlugin(app), app.file(EX));
    const draft = app.textOf("02 - Stories/Low Tide/Low Tide - Draft.md") ?? "";
    const blocks = findBlocks(draft);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ text: "The boat came back.\nThen the sea.", firstDraft: null });
    expect(draft).not.toMatch(/first-draft|The boat sat|Old ending/);
    expect(app.textOf(EX)?.endsWith("## Reflection\nGood.")).toBe(true);
  });
});
