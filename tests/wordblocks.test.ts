import { describe, expect, it } from "vitest";
import { moment } from "obsidian";
import { heatmapMatch } from "../src/wordblocks";
import { dailyWordsIn, heatmapGrid, type LogRow } from "../src/wordlog";
import { fakePlugin } from "./helpers/fake-app";

const rows: LogRow[] = [
  { date: "2026-11-24", path: "01 - Practice/Journal/2026-11-24.md", words: 300 },
  { date: "2026-11-24", path: "02 - Stories/Tide/Tide - Draft.md", words: 200 },
  { date: "2026-11-24", path: "03 - Projects/Low/Scenes/00-10 A.md", words: 100 },
  { date: "2026-11-24", path: "05 - Resources/A poem.md", words: 50 },
];
const wordsFor = (of: Parameters<typeof heatmapMatch>[1]) => dailyWordsIn(rows, heatmapMatch(fakePlugin(), of), "2026-01-01", "2026-12-31").get("2026-11-24");

describe("the heatmap block", () => {
  it("counts pieces by default, or what `of` picks", () => {
    expect(wordsFor("pieces")).toBe(300);
    expect(wordsFor("practice")).toBe(300);
    expect(wordsFor("stories")).toBe(200);
    expect(wordsFor("projects")).toBe(100);
    expect(wordsFor("all")).toBe(600);
  });

  it("Home's heatmap shows 48 weeks of all the writer's words", () => {
    const days = dailyWordsIn(rows, heatmapMatch(fakePlugin(), "all"), "2025-01-01", "2026-11-25");
    const grid = heatmapGrid(days, moment("2026-11-25"), 48, "monday");
    expect(grid).toHaveLength(48);
    expect(grid.flat().find((d) => d.date === "2026-11-24")).toMatchObject({ words: 600, level: 3 });
  });
});
