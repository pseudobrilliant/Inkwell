import { describe, expect, it } from "vitest";
import { countWords } from "../src/wordcount";

describe("countWords", () => {
  it("counts plain prose", () => {
    expect(countWords("The quick brown fox jumps.")).toBe(5);
  });

  it("ignores frontmatter", () => {
    expect(countWords("---\ntype: draft\ntitle: Many words here\n---\nOnly these three.")).toBe(3);
  });

  it("ignores code blocks, Obsidian comments and HTML comments", () => {
    const text = "One two\n```js\nconst a = 1;\n```\nthree %% hidden hint %% four <!-- also hidden --> five";
    expect(countWords(text)).toBe(5);
  });

  it("counts a wikilink's shown text, not its target", () => {
    expect(countWords("Meet [[Characters/Jane Doe|Jane]] today")).toBe(3);
    expect(countWords("See [[Some Long Note Name]]")).toBe(5);
  });

  it("counts a Markdown link's text, not its URL", () => {
    expect(countWords("Read [this essay](https://example.com/a-very-long-path) now")).toBe(4);
  });

  it("keeps contractions and hyphenated words whole, with straight or curly apostrophes", () => {
    expect(countWords("Don't stop — it’s well-known")).toBe(4);
  });

  it("counts non-Latin scripts and numbers", () => {
    expect(countWords("Привет мир 2026")).toBe(3);
  });

  it("is zero for an empty note or one with only frontmatter", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("---\ntype: draft\n---\n")).toBe(0);
  });

  it("handles Windows line endings in frontmatter", () => {
    expect(countWords("---\r\ntype: draft\r\n---\r\nTwo words")).toBe(2);
  });
});
