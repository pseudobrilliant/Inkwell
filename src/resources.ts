/**
 * Feeding the well: resources are other people's work you want to learn from (poems, books, posts, authors,
 * classes). They are captured from the quick capture popup straight into the resources folder, waiting to be
 * read and annotated later. See CLAUDE.md → Capture: feed the well.
 */
import { moment, normalizePath, Notice, TFile } from "obsidian";
import type InkwellPlugin from "./main";
import { createExercise } from "./exercise";
import { logCaptureInJournal } from "./journal";
import { pick } from "./modals";
import { loadTemplate, render } from "./templates";
import { cleanName, createNote, ensureFolder, fmOf, fmStr, sectionText, uniquePath } from "./util";

export const RESOURCE_KINDS = [
  "poem",
  "story",
  "essay",
  "article",
  "book",
  "craft-book",
  "author",
  "class",
  "video",
  "podcast",
  "website",
] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const RESOURCE_LABELS: Record<ResourceKind, string> = {
  poem: "Poem",
  story: "Story",
  essay: "Essay",
  article: "Article / post",
  book: "Book",
  "craft-book": "Craft book",
  author: "Author / poet",
  class: "Class / workshop",
  video: "Video",
  podcast: "Podcast",
  website: "Website",
};

/** Kinds shown behind "More…" in the capture popup, to keep it small. */
export const MORE_RESOURCE_KINDS: readonly ResourceKind[] = ["video", "podcast", "website"];

/** Statuses of a resource, in order. "to-do" and "in-progress" are what triage and Home's reading list use. */
export const RESOURCE_STATUSES = ["to-do", "in-progress", "done"] as const;

/** Kinds that older triage versions wrote. */
const KIND_ALIASES: Record<string, ResourceKind> = { course: "class", tool: "website" };

export function isResourceKind(k: unknown): k is ResourceKind {
  return typeof k === "string" && (RESOURCE_KINDS as readonly string[]).includes(k);
}

/** A resource's kind, reading older aliases. */
export function resourceKind(v: unknown): ResourceKind | null {
  const s = fmStr(v);
  if (isResourceKind(s)) return s;
  return KIND_ALIASES[s] ?? null;
}

export interface ParsedResource {
  title: string;
  author: string;
  url: string;
  why: string;
}

const URL_RE = /https?:\/\/[^\s)>\]]+/;
const cleanUrl = (u: string) => u.replace(/[.,;:!?'"]+$/, "");

/** A readable title from a URL: the last path segment's words, or the host. */
function titleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const words = decodeURIComponent(seg).replace(/\.[a-z0-9]+$/i, "").replace(/[-_+]+/g, " ").trim();
    if (words) return words.charAt(0).toUpperCase() + words.slice(1);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * What was typed in the capture popup:
 * line 1 is the title, with "by Author" (or "— Author") split off; the first URL anywhere is the link;
 * every other line is why you saved it. A line that is only a URL names the resource if nothing else does.
 */
export function parseResource(text: string, kind: ResourceKind): ParsedResource {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const urlMatch = text.match(URL_RE);
  const url = urlMatch ? cleanUrl(urlMatch[0]) : "";
  const isUrlOnly = (l: string) => l.replace(URL_RE, "").trim() === "";
  const textLines = lines.filter((l) => !isUrlOnly(l));

  let title = (textLines[0] ?? "").replace(URL_RE, "").trim();
  let author = "";
  // A person's name is the title; don't split it.
  if (title && kind !== "author") {
    const dash = title.match(/^(.+?)\s+[—–]\s+(.+)$/);
    const by = title.toLowerCase().lastIndexOf(" by ");
    if (by > 0) {
      author = title.slice(by + 4).trim();
      title = title.slice(0, by).trim();
    } else if (dash?.[1] && dash[2]) {
      title = dash[1].trim();
      author = dash[2].trim();
    }
  }
  if (!title && url) title = titleFromUrl(url);
  title = title.replace(/^["“'‘]+|["”'’]+$/g, "").trim();
  return { title, author, url, why: textLines.slice(1).join("\n") };
}

/** The template for a kind: a "Resource - <Kind>.md" note next to the resource template if there is one. */
async function resourceTemplate(plugin: InkwellPlugin, kind: ResourceKind): Promise<string> {
  const { app, settings } = plugin;
  const base = settings.templates.resource;
  if (base) {
    const dir = normalizePath(base).split("/").slice(0, -1).join("/");
    const name = `Resource - ${cleanName(RESOURCE_LABELS[kind].split(" / ")[0] ?? kind)}.md`;
    const override = app.vault.getFileByPath(normalizePath(dir ? `${dir}/${name}` : name));
    if (override) return app.vault.read(override);
  }
  return loadTemplate(app, settings, "resource");
}

/** Save a resource from the capture popup into the resources folder. The note isn't opened. */
export async function createResource(plugin: InkwellPlugin, kind: ResourceKind, text: string): Promise<TFile> {
  const { app, settings } = plugin;
  const r = parseResource(text, kind);
  const now = moment();
  const date = now.format("YYYY-MM-DD");
  const name = cleanName(r.title) || `${RESOURCE_LABELS[kind]} ${now.format("YYYY-MM-DD HHmm")}`;
  const path = uniquePath(app, settings.folders.resources, name);

  // Link back to the note you were reading when you captured it (an email pasted in your journal…).
  const active = app.workspace.getActiveFile();
  const from = active && active.extension === "md" ? `[[${active.basename}]]` : "";

  const tpl = await resourceTemplate(plugin, kind);
  const body = render(tpl, {
    title: r.title || name,
    author: r.author,
    url: r.url,
    why: r.why,
    kind: RESOURCE_LABELS[kind],
    date,
  });
  const file = await createNote(app, path, body, {
    type: "resource",
    kind,
    status: "to-do",
    author: r.author,
    url: r.url,
    created: now.format("YYYY-MM-DDTHH:mm"),
    // Same field as captures, so resources count as contribution the same way.
    captured: date,
    from,
  });
  await logCaptureInJournal(plugin, file, RESOURCE_LABELS[kind].toLowerCase());
  return file;
}

export function isResource(plugin: InkwellPlugin, file: TFile | null): file is TFile {
  return !!file && fmOf(plugin.app, file)?.type === "resource";
}

/** Every resource note, wherever it was filed: in progress first, then to-do, then newest. */
export function listResources(plugin: InkwellPlugin): TFile[] {
  const rank = (f: TFile) => {
    const s = fmStr(fmOf(plugin.app, f)?.status);
    return s === "in-progress" ? 0 : s === "done" ? 2 : 1;
  };
  return plugin.app.vault
    .getMarkdownFiles()
    .filter((f) => isResource(plugin, f))
    .sort((a, b) => rank(a) - rank(b) || b.stat.ctime - a.stat.ctime);
}

/** Start a timed exercise that responds to or imitates a resource (the open one, or one you pick). */
export async function exerciseFromResource(plugin: InkwellPlugin): Promise<void> {
  const { app } = plugin;
  const active = app.workspace.getActiveFile();
  let file: TFile | null = isResource(plugin, active) ? active : null;
  if (!file) {
    const all = listResources(plugin);
    if (!all.length) {
      new Notice('No resources yet. Use "Inkwell: Capture a resource" to add one.');
      return;
    }
    file = await pick(app, all, (f) => {
      const fm = fmOf(app, f);
      const kind = resourceKind(fm?.kind);
      const author = fmStr(fm?.author);
      return [f.basename, author, kind ? RESOURCE_LABELS[kind] : ""].filter(Boolean).join(" · ");
    }, "Pick a resource");
    if (!file) return;
  }
  const fm = fmOf(app, file);
  const author = fmStr(fm?.author);
  const source = `[[${file.basename}]]${author ? ` by ${author}` : ""}`;
  const tryThis = sectionText(await app.vault.read(file), "Try This");
  const text = tryThis ? `${tryThis}\n\nFrom ${source}` : `Respond to or imitate ${source}.`;
  await createExercise(plugin, null, { text, resource: file });
}

/** Open the resources table (a Bases file in the resources folder), creating it the first time. */
export async function createResourcesBase(plugin: InkwellPlugin): Promise<void> {
  const folder = normalizePath(plugin.settings.folders.resources);
  const path = `${folder}/Resources.base`;
  const existing = plugin.app.vault.getFileByPath(path);
  if (existing) {
    await plugin.app.workspace.getLeaf(false).openFile(existing);
    return;
  }
  await ensureFolder(plugin.app, folder);
  const base = `filters:
  and:
    - type == "resource"
views:
  - type: table
    name: To read
    filters:
      and:
        - status != "done"
    order:
      - file.name
      - kind
      - author
      - status
      - created
    groupBy:
      property: note.status
      direction: ASC
    sort:
      - property: created
        direction: DESC
  - type: table
    name: All resources
    order:
      - file.name
      - kind
      - author
      - status
      - created
    sort:
      - property: created
        direction: DESC
`;
  const file = await plugin.app.vault.create(path, base);
  await plugin.app.workspace.getLeaf(false).openFile(file);
}
