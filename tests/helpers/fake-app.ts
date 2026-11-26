/**
 * An in-memory vault with the parts of Obsidian's App that Inkwell uses: vault, fileManager, metadataCache
 * (frontmatter parsed from the file text, like Obsidian's), a no-op workspace, and local storage.
 * Strict where Obsidian is: creating a file that exists, or one whose folder is missing, throws.
 */
import { parse, stringify } from "yaml";
import { normalizePath, TAbstractFile, TFile, TFolder } from "obsidian";
import type InkwellPlugin from "../../src/main";
import { mergeSettings, type InkwellSettings } from "../../src/settings";

const FM = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function splitFrontmatter(text: string): { fm: Record<string, unknown> | null; body: string } {
  const m = text.match(FM);
  if (!m) return { fm: null, body: text };
  const fm: unknown = parse(m[1] ?? "");
  return { fm: fm && typeof fm === "object" ? (fm as Record<string, unknown>) : {}, body: text.slice(m[0].length) };
}

const parentPath = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "/");
const baseName = (p: string) => p.slice(p.lastIndexOf("/") + 1);

export class FakeApp {
  private items = new Map<string, TAbstractFile>();
  private text = new Map<string, string>();
  private local = new Map<string, unknown>();
  readonly trashed: string[] = [];
  readonly opened: string[] = [];
  private clock = 1_000;

  constructor() {
    const root = new TFolder();
    root.path = "/";
    root.name = "";
    this.items.set("/", root);
  }

  // ---------- helpers for tests ----------

  /** Create files (and their folders) from `path → text`. */
  seed(files: Record<string, string>): this {
    for (const [path, body] of Object.entries(files)) {
      this.mkdirs(parentPath(normalizePath(path)));
      this.addFile(normalizePath(path), body);
    }
    return this;
  }

  /** Paths of every file, sorted. */
  paths(): string[] {
    return [...this.items.values()].filter((f) => f instanceof TFile).map((f) => f.path).sort();
  }

  textOf(path: string): string | undefined {
    return this.text.get(normalizePath(path));
  }

  fmOfPath(path: string): Record<string, unknown> | null {
    const t = this.textOf(path);
    return t === undefined ? null : splitFrontmatter(t).fm;
  }

  file(path: string): TFile {
    const f = this.items.get(normalizePath(path));
    if (!(f instanceof TFile)) throw new Error(`No file at ${path}`);
    return f;
  }

  folder(path: string): TFolder {
    const f = this.items.get(normalizePath(path));
    if (!(f instanceof TFolder)) throw new Error(`No folder at ${path}`);
    return f;
  }

  // ---------- internals ----------

  private mkdirs(path: string) {
    if (path === "/" || this.items.get(path) instanceof TFolder) return;
    this.mkdirs(parentPath(path));
    this.addFolder(path);
  }

  private attach(item: TAbstractFile, path: string) {
    const parent = this.items.get(parentPath(path));
    if (!(parent instanceof TFolder)) throw new Error(`Folder missing for ${path}`);
    item.path = path;
    item.name = baseName(path);
    item.parent = parent;
    parent.children.push(item);
    this.items.set(path, item);
  }

  private detach(item: TAbstractFile) {
    const parent = item.parent;
    if (parent) parent.children = parent.children.filter((c) => c !== item);
    this.items.delete(item.path);
  }

  private addFolder(path: string): TFolder {
    if (this.items.has(path)) throw new Error(`Already exists: ${path}`);
    const f = new TFolder();
    this.attach(f, path);
    return f;
  }

  private addFile(path: string, body: string): TFile {
    if (this.items.has(path)) throw new Error(`Already exists: ${path}`);
    const f = new TFile();
    this.attach(f, path);
    this.write(f, body);
    return f;
  }

  private write(f: TFile, body: string) {
    this.text.set(f.path, body);
    f.stat = { ctime: f.stat.ctime || this.clock, mtime: ++this.clock, size: body.length };
  }

  /** Move a file or folder (with everything in it) to a new path, as a rename does. */
  private move(item: TAbstractFile, to: string) {
    if (this.items.has(to)) throw new Error(`Already exists: ${to}`);
    const parent = this.items.get(parentPath(to));
    if (!(parent instanceof TFolder)) throw new Error(`Folder missing for ${to}`);
    if (item.parent) item.parent.children = item.parent.children.filter((c) => c !== item);
    const rekey = (x: TAbstractFile, path: string) => {
      const body = this.text.get(x.path);
      this.items.delete(x.path);
      this.text.delete(x.path);
      x.path = path;
      x.name = baseName(path);
      this.items.set(path, x);
      if (body !== undefined) this.text.set(path, body);
      if (x instanceof TFolder) for (const c of x.children) rekey(c, `${path}/${c.name}`);
    };
    rekey(item, to);
    item.parent = parent;
    parent.children.push(item);
  }

  private remove(item: TAbstractFile) {
    if (item instanceof TFolder) for (const c of [...item.children]) this.remove(c);
    this.detach(item);
    this.text.delete(item.path);
  }

  // ---------- Obsidian's API ----------

  vault = {
    configDir: ".obsidian",
    getAbstractFileByPath: (p: string) => this.items.get(normalizePath(p)) ?? null,
    getFileByPath: (p: string) => {
      const f = this.items.get(normalizePath(p));
      return f instanceof TFile ? f : null;
    },
    getFolderByPath: (p: string) => {
      const f = this.items.get(normalizePath(p));
      return f instanceof TFolder ? f : null;
    },
    getMarkdownFiles: () => [...this.items.values()].filter((f): f is TFile => f instanceof TFile && f.extension === "md"),
    getFiles: () => [...this.items.values()].filter((f): f is TFile => f instanceof TFile),
    createFolder: async (p: string) => this.addFolder(normalizePath(p)),
    create: async (p: string, body: string) => this.addFile(normalizePath(p), body),
    read: async (f: TFile) => this.text.get(f.path) ?? "",
    cachedRead: async (f: TFile) => this.text.get(f.path) ?? "",
    modify: async (f: TFile, body: string) => this.write(f, body),
    process: async (f: TFile, fn: (t: string) => string) => {
      const next = fn(this.text.get(f.path) ?? "");
      this.write(f, next);
      return next;
    },
    copy: async (f: TFile, to: string) => this.addFile(normalizePath(to), this.text.get(f.path) ?? ""),
    on: () => ({}),
  };

  fileManager = {
    processFrontMatter: async (f: TFile, fn: (fm: Record<string, unknown>) => void) => {
      const { fm, body } = splitFrontmatter(this.text.get(f.path) ?? "");
      const data = fm ?? {};
      fn(data);
      this.write(f, `---\n${stringify(data)}---\n${body}`);
    },
    renameFile: async (f: TAbstractFile, to: string) => this.move(f, normalizePath(to)),
    trashFile: async (f: TAbstractFile) => {
      this.trashed.push(f.path);
      this.remove(f);
    },
  };

  metadataCache = {
    getFileCache: (f: TFile) => {
      const t = this.text.get(f.path);
      if (t === undefined) return null;
      const { fm } = splitFrontmatter(t);
      return fm ? { frontmatter: fm } : {};
    },
    on: () => ({}),
  };

  workspace = {
    getLeaf: () => ({ openFile: async (f: TFile) => void this.opened.push(f.path) }),
    getActiveFile: () => null,
    on: () => ({}),
  };

  loadLocalStorage = (key: string) => (this.local.has(key) ? this.local.get(key) : null);
  saveLocalStorage = (key: string, v: unknown) => {
    if (v === null) this.local.delete(key);
    else this.local.set(key, v);
  };
}

/** A stand-in for the plugin: the fake app, default settings (with overrides), and Keep the Rhythm switched off. */
export function fakePlugin(app = new FakeApp(), settings: Partial<InkwellSettings> = {}): InkwellPlugin & { app: FakeApp } {
  const s = mergeSettings(settings).settings;
  return {
    app,
    settings: s,
    saveSettings: async () => undefined,
    ktr: {
      status: () => ({ ok: false, message: "off" }),
      wordsThisWeek: async () => null,
      words: async () => null,
      dailyWords: async () => null,
      streak: async () => null,
      weekStart: async () => "2026-11-23",
    },
  } as unknown as InkwellPlugin & { app: FakeApp };
}
