import { App, normalizePath, TFile, TFolder } from "obsidian";

/** Strip characters Obsidian/OSes don't allow in file names. */
export function cleanName(s: string): string {
  return s.replace(/[\\/:*?"<>|#^[\]]/g, "").replace(/\s+/g, " ").trim();
}

/** First few words of a text, for use as a note name. */
export function slugWords(text: string, maxWords = 6, maxLen = 50): string {
  const words = cleanName(text.split("\n")[0] ?? "").split(" ").slice(0, maxWords).join(" ");
  return words.length > maxLen ? words.slice(0, maxLen).trim() : words;
}

export async function ensureFolder(app: App, path: string): Promise<void> {
  const p = normalizePath(path);
  if (!p || p === "/") return;
  const existing = app.vault.getAbstractFileByPath(p);
  if (existing instanceof TFolder) return;
  if (existing) throw new Error(`"${p}" exists and is not a folder`);
  const parent = p.split("/").slice(0, -1).join("/");
  if (parent) await ensureFolder(app, parent);
  await app.vault.createFolder(p);
}

/** Returns `folder/name.md`, adding " 2", " 3"… if a note with that name exists. */
export function uniquePath(app: App, folder: string, name: string): string {
  const base = normalizePath(`${folder}/${name}`);
  let path = `${base}.md`;
  for (let i = 2; app.vault.getAbstractFileByPath(path); i++) path = `${base} ${i}.md`;
  return path;
}

/**
 * Create a note from text, then set frontmatter fields through processFrontMatter
 * so required fields are always correct regardless of what the template contains.
 */
export async function createNote(
  app: App,
  path: string,
  body: string,
  fields: Record<string, unknown>
): Promise<TFile> {
  await ensureFolder(app, path.split("/").slice(0, -1).join("/"));
  const file = await app.vault.create(path, body);
  await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
    for (const [k, v] of Object.entries(fields)) fm[k] = v;
  });
  return file;
}

/** Move a file into a folder (optionally renaming), keeping links updated. */
export async function moveFile(app: App, file: TFile, folder: string, newName?: string): Promise<TFile> {
  await ensureFolder(app, folder);
  const target = uniquePath(app, folder, newName ? cleanName(newName) || file.basename : file.basename);
  await app.fileManager.renameFile(file, target);
  return file;
}

/** Body text without frontmatter. */
export function stripFrontmatter(text: string): string {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/, "");
}

/** Frontmatter as Obsidian hands it over, typed so every field must be checked before use. */
export type Frontmatter = Record<string, unknown>;

/** Cached frontmatter of a note, or undefined if it has none. */
export function fmOf(app: App, file: TFile | null | undefined): Frontmatter | undefined {
  if (!file) return undefined;
  const fm: Frontmatter | undefined = app.metadataCache.getFileCache(file)?.frontmatter;
  return fm;
}

/** A frontmatter value as text: strings, numbers, booleans and dates as-is; lists, objects and null as "". */
export function fmStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
  return "";
}
