import { moment, TFile } from "obsidian";
import type InkwellPlugin from "./main";
import { askForm, pick } from "./modals";
import { pickDrill, type Drill } from "./drills";
import { listPrompts, markPromptUsed, Prompt, promptText, rankPrompts } from "./prompts";
import { loadTemplate, render } from "./templates";
import { cleanName, createNote, slugWords, uniquePath } from "./util";

type Choice = { label: string; prompt: Prompt | null; random?: boolean };

/** Ask which prompt to use (random / none / a specific one), then create the exercise. */
export async function newExercise(plugin: InkwellPlugin): Promise<void> {
  const ranked = rankPrompts(listPrompts(plugin));
  const choices: Choice[] = [
    ...(ranked.length ? [{ label: "🎲 Random prompt", prompt: null, random: true }] : []),
    { label: "No prompt — free exercise", prompt: null },
    ...ranked.map((p) => ({ label: p.file.basename, prompt: p })),
  ];
  const c = await pick(plugin.app, choices, (x) => x.label, "Pick a prompt");
  if (!c) return;
  await createExercise(plugin, c.random ? (ranked[0] ?? null) : c.prompt);
}

export async function createExercise(
  plugin: InkwellPlugin,
  prompt: Prompt | null,
  opts: { text?: string; drill?: Drill; resource?: TFile } = {}
): Promise<TFile | null> {
  const { app, settings } = plugin;
  const { drill, resource } = opts;
  const drillText = drill ? `Drill: [[${drill.file.basename}]]${drill.skill ? ` (${drill.skill})` : ""}` : "";
  const text = opts.text ?? (prompt ? await promptText(app, prompt.file) : drillText);
  const v = await askForm(app, "New exercise", [
    { key: "title", label: "Title", value: drill ? drill.file.basename : resource ? `After ${resource.basename}` : text ? slugWords(text, 8, 60) : "", required: true },
    { key: "minutes", label: "Timer goal (minutes)", type: "number", value: String(drill?.minutes || settings.exerciseMinutes) },
  ]);
  if (!v) return null;
  const date = moment().format("YYYY-MM-DD");
  const title = cleanName(v.title) || "Exercise";
  const path = uniquePath(app, settings.folders.writings, `${date} ${title}`);
  const tpl = await loadTemplate(app, settings, "exercise");
  const minutes = parseInt(v.minutes, 10) || 0;
  const file: TFile = await createNote(app, path, render(tpl, { title, date, prompt_text: text }), {
    type: "exercise",
    created: date,
    prompt: prompt ? `[[${prompt.file.basename}]]` : "",
    ...(drill ? { drill: `[[${drill.file.basename}]]` } : {}),
    ...(resource ? { resource: `[[${resource.basename}]]` } : {}),
    minutes: minutes || null,
    became: "",
  });
  if (prompt) await markPromptUsed(app, prompt.file);
  await app.workspace.getLeaf(false).openFile(file);
  await plugin.timer.arm(file, minutes, true);
  return file;
}

/** Start an exercise from a drill: the active drill note, or one picked from the list. */
export async function exerciseFromDrill(plugin: InkwellPlugin): Promise<void> {
  const drill = await pickDrill(plugin);
  if (drill) await createExercise(plugin, null, { drill });
}
