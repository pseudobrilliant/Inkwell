import { moment, normalizePath, Notice, TFile, TFolder } from "obsidian";
import type InkwellPlugin from "./main";
import { askForm } from "./modals";
import { PROJECT_FOLDERS, sceneFileName } from "./projects";
import type { Story } from "./stories";
import { createNote, ensureFolder, moveFile, slugWords, stripFrontmatter, uniquePath } from "./util";

interface SceneText {
  title: string;
  text: string;
}

const SEPARATOR = /^\s*(\*\s*\*\s*\*[\s*]*|-{3,}|_{3,})\s*$/;
const HEADING = /^#{1,3}\s+(.+?)\s*#*\s*$/;

/** Split draft prose into scenes at headings (# – ###) and *** / --- / ___ breaks. */
export function splitScenes(body: string): SceneText[] {
  const scenes: SceneText[] = [];
  let title = "";
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join("\n").trim();
    if (text || title) scenes.push({ title, text });
    title = "";
    buf = [];
  };
  for (const line of body.split("\n")) {
    const h = line.match(HEADING);
    if (h) {
      flush();
      title = h[1].trim();
    } else if (SEPARATOR.test(line)) {
      flush();
    } else {
      buf.push(line);
    }
  }
  flush();
  return scenes
    .filter((s) => s.text || s.title)
    .map((s, i) => ({ ...s, title: s.title || slugWords(s.text, 6, 50) || `Scene ${i + 1}` }));
}

export async function promoteToLongForm(plugin: InkwellPlugin, story: Story): Promise<void> {
  const { app, settings } = plugin;
  const { hub, draft } = story;
  if (!hub || !draft) {
    new Notice("Promote needs both a story hub and a draft.");
    return;
  }
  const title = story.name;
  const dest = normalizePath(`${settings.folders.longProjects}/${title}`);
  if (app.vault.getAbstractFileByPath(dest)) {
    new Notice(`"${dest}" already exists.`);
    return;
  }

  const scenes = splitScenes(stripFrontmatter(await app.vault.read(draft)));
  const hubFm = app.metadataCache.getFileCache(hub)?.frontmatter ?? {};
  const v = await askForm(
    app,
    `Promote "${title}" to long form`,
    [
      {
        key: "target",
        label: "Project word target",
        type: "number",
        value: String(settings.defaultLongTarget || hubFm.target_wordcount || ""),
      },
    ],
    "Promote",
    `This creates ${dest}/ in StoryLine's layout: the draft is split into ${scenes.length} scene(s) at headings and *** breaks, characters and locations move to Codex/, and Notes/ and Archive/ come along.\n\n` +
      `Nothing is lost: the original draft and a copy of the hub are kept in the new project's Archive/. The hub itself moves and becomes the project note, so links to it keep working.`
  );
  if (!v) return;

  const today = moment().format("YYYY-MM-DD");
  const archive = `${dest}/Archive`;
  await ensureFolder(app, archive);
  for (const sub of PROJECT_FOLDERS) await ensureFolder(app, `${dest}/${sub}`);

  // 1. Safety first: copy the hub, move the untouched draft into Archive/.
  await app.vault.copy(hub, uniquePath(app, archive, `${hub.basename} - Short Story Hub`));
  await moveFile(app, draft, archive);

  // 2. Scenes.
  const sceneTarget = settings.defaultSceneTarget || undefined;
  const status = settings.longStatuses.includes("draft") ? "draft" : settings.longStatuses[0] ?? "draft";
  for (let i = 0; i < scenes.length; i++) {
    const seq = (i + 1) * 10;
    const s = scenes[i];
    const fields: Record<string, unknown> = {
      type: "scene",
      id: crypto.randomUUID(),
      title: s.title,
      sequence: seq,
      status,
      characters: [],
      location: "",
      created: today,
    };
    if (sceneTarget) fields.target_wordcount = sceneTarget;
    await createNote(app, uniquePath(app, `${dest}/Scenes`, sceneFileName(seq, s.title)), s.text ? s.text + "\n" : "", fields);
  }

  // 3. Everything else in the story folder.
  const projectLink = `[[${title}]]`;
  const moveAll = async (folder: TFolder, target: string) => {
    for (const c of [...folder.children]) {
      if (c instanceof TFolder) await moveAll(c, `${target}/${c.name}`);
      else if (c instanceof TFile) await moveFile(app, c, target);
    }
  };
  for (const c of [...story.folder.children]) {
    if (c === hub) continue;
    if (c instanceof TFolder) {
      await moveAll(c, c.name === "Archive" ? archive : `${dest}/${c.name}`);
      continue;
    }
    if (!(c instanceof TFile)) continue;
    const type = app.metadataCache.getFileCache(c)?.frontmatter?.type;
    if (c.extension === "md" && (type === "character" || type === "location" || type === "place")) {
      await app.fileManager.processFrontMatter(c, (fm) => {
        fm.project = projectLink;
        if (fm.type === "place") fm.type = "location";
      });
      await moveFile(app, c, `${dest}/Codex/${type === "character" ? "Characters" : "Locations"}`);
    } else {
      await moveFile(app, c, `${dest}/Notes`);
    }
  }

  // 4. The hub becomes the StoryLine project note (moved, so links follow it).
  await app.fileManager.renameFile(hub, `${dest}/${title}.md`);
  await app.fileManager.processFrontMatter(hub, (fm) => {
    fm.type = "storyline";
    fm.title = title;
    fm.language = fm.language ?? "en";
    fm.bookId = fm.bookId ?? crypto.randomUUID();
    fm.promoted = today;
    const t = parseInt(v.target, 10);
    if (t > 0) fm.target_wordcount = t;
  });

  // 5. Remove the now-empty short-story folder (to trash, recoverable).
  const isEmpty = (f: TFolder): boolean => f.children.every((c) => c instanceof TFolder && isEmpty(c));
  if (isEmpty(story.folder)) await app.fileManager.trashFile(story.folder);

  await app.workspace.getLeaf(false).openFile(hub);
  new Notice(`"${title}" is now a long project with ${scenes.length} scene(s). Open it in StoryLine to continue.`);
}
