/**
 * Feeding the well: resources are other people's work you want to learn from (poems, stories, books, articles,
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

export const RESOURCE_KINDS = ["poem", "story", "essay", "article", "book", "class", "other"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const RESOURCE_LABELS: Record<ResourceKind, string> = {
  poem: "Poem",
  story: "Story",
  essay: "Essay",
  article: "Article",
  book: "Book",
  class: "Class",
  other: "Other",
};

/** Statuses of a resource, in order. "to-do" and "in-progress" are what triage and Home's reading list use. */
export const RESOURCE_STATUSES = ["to-do", "in-progress", "done"] as const;

/** Kinds that older versions wrote. */
const KIND_ALIASES: Record<string, ResourceKind> = {
  course: "class",
  "craft-book": "book",
  link: "other",
  tool: "other",
  website: "other",
  video: "other",
  podcast: "other",
};

export function isResourceKind(k: unknown): k is ResourceKind {
  return typeof k === "string" && (RESOURCE_KINDS as readonly string[]).includes(k);
}

/** A resource's kind, reading older aliases. */
export function resourceKind(v: unknown): ResourceKind | null {
  const s = fmStr(v);
  if (isResourceKind(s)) return s;
  return KIND_ALIASES[s] ?? null;
}

/** What the capture popup asks for. Every key but `title` and `text` is also a frontmatter field. */
export type ResourceField = "title" | "author" | "teacher" | "where" | "start" | "end" | "url" | "text";
export type ResourceValues = Partial<Record<ResourceField, string>>;

export interface FieldDef {
  key: ResourceField;
  label: string;
  placeholder?: string;
  /** A text box rather than a one-line field. */
  multiline?: boolean;
  /** A date picker (saved as YYYY-MM-DD). */
  date?: boolean;
}

const TITLE: FieldDef = { key: "title", label: "Title" };
const LINK: FieldDef = { key: "url", label: "Link", placeholder: "https://…" };

/** The fields each kind asks for, in order. The first one is focused. */
export const RESOURCE_FIELDS: Record<ResourceKind, FieldDef[]> = {
  poem: [TITLE, { key: "author", label: "Poet" }, { key: "text", label: "Poem text", placeholder: "Paste the poem (optional)", multiline: true }, LINK],
  story: [TITLE, { key: "author", label: "Author" }, LINK],
  essay: [TITLE, { key: "author", label: "Author" }, LINK],
  article: [TITLE, { key: "author", label: "Author" }, { key: "where", label: "Site", placeholder: "Blog or publication" }, LINK],
  book: [TITLE, { key: "author", label: "Author" }],
  class: [{ key: "title", label: "Class name" }, { key: "teacher", label: "Teacher" }, { key: "where", label: "Where", placeholder: "Lighthouse, online…" }, { key: "start", label: "Starts", date: true }, { key: "end", label: "Ends", date: true }, LINK],
  other: [{ key: "title", label: "Title", placeholder: "Video, podcast, site…" }, { key: "author", label: "By" }, LINK],
};

/** Frontmatter fields a resource can carry, in the order they're listed in the note's Source section. */
const SOURCE_FIELDS = ["author", "teacher", "where", "start", "end", "url"] as const;

export interface ParsedResource {
  title: string;
  author: string;
  url: string;
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
 * Free text about a resource (a title field, or pasted lines): line 1 is the title, with "by Author"
 * (or "— Author") split off; the first URL anywhere is the link. A line that is only a URL names the
 * resource if nothing else does.
 */
export function parseResource(text: string): ParsedResource {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const urlMatch = text.match(URL_RE);
  const url = urlMatch ? cleanUrl(urlMatch[0]) : "";
  const isUrlOnly = (l: string) => l.replace(URL_RE, "").trim() === "";
  const textLines = lines.filter((l) => !isUrlOnly(l));

  let title = (textLines[0] ?? "").replace(URL_RE, "").trim();
  let author = "";
  if (title) {
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
  return { title, author, url };
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

/**
 * Tidy what was typed: a pasted "Title by Author" fills an empty author field, a link pasted as the title
 * moves to the link field (and names the resource from the URL), and only the kind's own fields are kept.
 */
export function resourceValues(kind: ResourceKind, input: ResourceValues): Record<ResourceField, string> {
  const own = new Set(RESOURCE_FIELDS[kind].map((f) => f.key));
  const get = (k: ResourceField) => (own.has(k) ? (input[k] ?? "").trim() : "");
  const v: Record<ResourceField, string> = {
    title: get("title"),
    author: get("author"),
    teacher: get("teacher"),
    where: get("where"),
    start: get("start"),
    end: get("end"),
    url: get("url"),
    text: get("text"),
  };
  const parsed = parseResource(v.title);
  v.title = parsed.title;
  if (!v.url && parsed.url) v.url = parsed.url;
  // Classes have a teacher, not an author, so "Class by Teacher" fills the teacher.
  const person: ResourceField = own.has("author") ? "author" : own.has("teacher") ? "teacher" : "author";
  if (parsed.author && own.has(person)) {
    if (!v[person]) v[person] = parsed.author;
  } else if (parsed.author) {
    v.title = `${v.title} by ${parsed.author}`;
  }
  if (!v.title && v.url) v.title = titleFromUrl(v.url);
  return v;
}

/** The note's Source section: one line per field that was filled in, labelled the way the kind asked for it. */
function sourceLines(kind: ResourceKind, v: Record<ResourceField, string>): string {
  const label = (k: ResourceField) => RESOURCE_FIELDS[kind].find((f) => f.key === k)?.label ?? k;
  return SOURCE_FIELDS.filter((k) => v[k]).map((k) => `- **${label(k)}:** ${v[k]}`).join("\n");
}

/** Save a resource from the capture popup into the resources folder. The note isn't opened. */
export async function createResource(plugin: InkwellPlugin, kind: ResourceKind, input: ResourceValues): Promise<TFile> {
  const { app, settings } = plugin;
  const r = resourceValues(kind, input);
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
    teacher: r.teacher,
    where: r.where,
    start: r.start,
    end: r.end,
    url: r.url,
    // The pasted text (a poem) as its own section, so the note has nothing extra when there isn't any.
    text: r.text ? `## Text\n${r.text}\n\n` : "",
    source: sourceLines(kind, r),
    kind: RESOURCE_LABELS[kind],
    date,
  });
  // Only the fields this kind asks for, so a book doesn't get an empty `teacher`.
  const fields: Record<string, string> = {};
  for (const f of RESOURCE_FIELDS[kind]) if (f.key !== "title" && f.key !== "text") fields[f.key] = r[f.key];
  const file = await createNote(app, path, body, {
    type: "resource",
    kind,
    status: "to-do",
    ...fields,
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
      const author = fmStr(fm?.author) || fmStr(fm?.teacher);
      return [f.basename, author, kind ? RESOURCE_LABELS[kind] : ""].filter(Boolean).join(" · ");
    }, "Pick a resource");
    if (!file) return;
  }
  const fm = fmOf(app, file);
  const author = fmStr(fm?.author) || fmStr(fm?.teacher);
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
      - teacher
      - where
      - start
      - end
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
      - teacher
      - where
      - start
      - end
      - status
      - created
    sort:
      - property: created
        direction: DESC
`;
  const file = await plugin.app.vault.create(path, base);
  await plugin.app.workspace.getLeaf(false).openFile(file);
}
