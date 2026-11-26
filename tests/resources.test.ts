import { describe, expect, it } from "vitest";
import { parseResource, RESOURCE_KINDS, RESOURCE_SECTIONS, resourceKind, resourceSections, resourceValues } from "../src/resources";

describe("parseResource", () => {
  it("splits 'Title by Author'", () => {
    expect(parseResource("The Fish by Elizabeth Bishop")).toEqual({ title: "The Fish", author: "Elizabeth Bishop", url: "" });
  });

  it("splits on the last ' by ', so titles may contain 'by'", () => {
    expect(parseResource("Stand by Me by Stephen King").author).toBe("Stephen King");
  });

  it("splits 'Title — Author' with a dash", () => {
    expect(parseResource("Bird by Bird — Anne Lamott").title).toBe("Bird");
    expect(parseResource("Wild Geese — Mary Oliver")).toMatchObject({ title: "Wild Geese", author: "Mary Oliver" });
  });

  it("finds a URL anywhere and trims trailing punctuation", () => {
    expect(parseResource("Great read: https://example.com/post.").url).toBe("https://example.com/post");
  });

  it("names a resource from a bare URL", () => {
    expect(parseResource("https://example.com/blog/the-art-of-revision.html")).toEqual({
      title: "The art of revision",
      author: "",
      url: "https://example.com/blog/the-art-of-revision.html",
    });
    expect(parseResource("https://www.example.com/").title).toBe("example.com");
  });

  it("strips quotes around a title", () => {
    expect(parseResource("“Hills Like White Elephants” by Hemingway").title).toBe("Hills Like White Elephants");
  });
});

describe("resourceValues", () => {
  it("fills an empty author from 'Title by Author'", () => {
    const v = resourceValues("poem", { title: "The Fish by Elizabeth Bishop" });
    expect(v).toMatchObject({ title: "The Fish", author: "Elizabeth Bishop" });
  });

  it("keeps an author that was typed in", () => {
    expect(resourceValues("book", { title: "Bird by Anne", author: "Anne Lamott" }).author).toBe("Anne Lamott");
  });

  it("fills a class's teacher, not an author", () => {
    const v = resourceValues("class", { title: "Poetry Workshop by Ada Limón" });
    expect(v).toMatchObject({ title: "Poetry Workshop", teacher: "Ada Limón", author: "" });
  });

  it("moves a link pasted as the title to the link field", () => {
    const v = resourceValues("article", { title: "https://example.com/craft/show-dont-tell" });
    expect(v).toMatchObject({ title: "Show dont tell", url: "https://example.com/craft/show-dont-tell" });
  });

  it("keeps 'by' in the title for a kind with no person field", () => {
    const fields = resourceValues("book", { title: "x" });
    expect(fields.teacher).toBe("");
  });

  it("drops fields the kind doesn't ask for", () => {
    const v = resourceValues("book", { title: "Book", url: "https://x.y", where: "Somewhere", text: "poem" });
    expect(v).toMatchObject({ url: "", where: "", text: "" });
  });
});

describe("resource kinds", () => {
  it("reads older kinds as aliases", () => {
    expect(resourceKind("course")).toBe("class");
    expect(resourceKind("craft-book")).toBe("book");
    for (const k of ["link", "website", "video", "podcast", "tool"]) expect(resourceKind(k)).toBe("other");
    expect(resourceKind("poem")).toBe("poem");
    expect(resourceKind("nonsense")).toBeNull();
    expect(resourceKind(["poem"])).toBeNull();
  });

  it("gives every kind its sections as headings, with hints as hidden comments", () => {
    for (const k of RESOURCE_KINDS) {
      const md = resourceSections(k);
      for (const h of RESOURCE_SECTIONS[k]) expect(md).toContain(`## ${h}\n`);
    }
    expect(resourceSections("article")).toContain("## What I'll Use\n%% ");
    expect(resourceSections("class")).toContain("## Sessions\n### Session 1\n");
  });
});
