import { Notice, TFile } from "obsidian";
import type InkwellPlugin from "./main";
import { askStoryDetails, createShortStory } from "./stories";
import { stripFrontmatter, fmOf, type Frontmatter, fmStr } from "./util";

export function isExercise(plugin: InkwellPlugin, file: TFile | null): file is TFile {
  return !!file && fmOf(plugin.app, file)?.type === "exercise";
}

/** The "## Work" section of an exercise, or the whole body if there isn't one. */
function workSection(text: string): string {
  const body = stripFrontmatter(text);
  const lines = body.split("\n");
  const start = lines.findIndex((l) => /^##\s+Work\s*$/i.test(l.trim()));
  if (start === -1) return body.trim();
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,2}\s/.test(lines[i] ?? "")) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n").trim();
}

/** Promote an exercise into a short story. The exercise is copied, never changed except for `became`. */
export async function exerciseBecameStory(plugin: InkwellPlugin, exercise: TFile): Promise<void> {
  const { app } = plugin;
  const fm = fmOf(app, exercise);
  if (fm?.became) {
    new Notice(`This exercise already became ${fmStr(fm.became)}`);
    return;
  }
  const input = await askStoryDetails(
    plugin,
    { title: exercise.basename.replace(/^\d{4}-\d{2}-\d{2}\s+/, "") },
    "This became a story"
  );
  if (!input) return;
  const work = workSection(await app.vault.read(exercise));
  const story = await createShortStory(plugin, input, {
    draftBody: work,
    hubFields: { from: `[[${exercise.basename}]]` },
  });
  if (!story) return;
  await app.fileManager.processFrontMatter(exercise, (f: Frontmatter) => (f.became = `[[${input.title}]]`));
  new Notice(`"${input.title}" created from the exercise`);
}
