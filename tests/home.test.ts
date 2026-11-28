import { describe, expect, it } from "vitest";
import { openHome } from "../src/home";
import { fakePlugin, FakeApp } from "./helpers/fake-app";

const HOME = "00 - Home/00 - Home.md";

describe("Home", () => {
  it("a new Home uses Inkwell's word blocks and no Keep the Rhythm blocks", async () => {
    const plugin = fakePlugin();
    await openHome(plugin);
    const text = plugin.app.textOf(HOME) ?? "";
    expect(text).toContain("```inkwell-heatmap\nof: all\nweeks: 48\n```");
    expect(text).toContain("```inkwell-words");
    expect(text).toContain("```inkwell-recent");
    expect(text).not.toContain('file.inFolder("01 - Practice")');
    expect(text).not.toContain("ktr-");
    expect(plugin.app.opened).toEqual([HOME]);
  });

  it("an existing Home is opened unchanged", async () => {
    const old = "# Home\n```ktr-heatmap\n```\n```ktr-slots\nCURRENT_DAY, WORDS\n```\n";
    const plugin = fakePlugin(new FakeApp().seed({ [HOME]: old }));
    await openHome(plugin);
    expect(plugin.app.textOf(HOME)).toBe(old);
  });
});
