import { Notice, TFile } from "obsidian";
import type InkwellPlugin from "./main";
import { askStoryDetails, createShortStory } from "./stories";
import { sectionText, stripFrontmatter, fmOf, type Frontmatter, fmStr } from "./util";
import { unwrapBlocks } from "./writingblocks";

export function isExercise(plugin: InkwellPlugin, file: TFile | null): file is TFile {
  return !!file && fmOf(plugin.app, file)?.type === "exercise";
}

/**
 * The "## Work" section of an exercise, or the whole body if there isn't one. Writing blocks in it come out as
 * plain paragraphs of their current text: the story starts from the revision, never the kept first draft. The story's
 * draft puts it back in a writing block.
 */
export function workSection(text: string): string {
  return unwrapBlocks(sectionText(text, "Work") ?? stripFrontmatter(text).trim()).trim();
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
    draftWriting: work,
    hubFields: { from: `[[${exercise.basename}]]` },
  });
  if (!story) return;
  await app.fileManager.processFrontMatter(exercise, (f: Frontmatter) => (f.became = `[[${input.title}]]`));
  new Notice(`"${input.title}" created from the exercise`);
}
