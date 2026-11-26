import { moment, normalizePath, TFile } from "obsidian";
import type InkwellPlugin from "./main";
import { promptOfTheDay, promptText } from "./prompts";
import { loadTemplate, render } from "./templates";
import { createNote } from "./util";

/** Today's journal note, created from the template if it doesn't exist yet. */
export async function ensureTodaysJournal(plugin: InkwellPlugin): Promise<TFile> {
  const { app, settings } = plugin;
  const date = moment().format(settings.journalDateFormat);
  const path = normalizePath(`${settings.folders.journal}/${date}.md`);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return existing;

  // Written as plain text so old journals keep the prompt they actually had.
  let promptBlock = "";
  const p = await promptOfTheDay(plugin);
  if (p) {
    const text = await promptText(app, p.file);
    const link = app.fileManager.generateMarkdownLink(p.file, path);
    promptBlock = `> [!quote] Prompt of the day\n> ${text} — ${link}\n`;
  }
  const tpl = await loadTemplate(app, settings, "journal");
  return createNote(app, path, render(tpl, { date, title: date, prompt_of_the_day: promptBlock }), {
    type: "journal",
    created: date,
  });
}

export async function openTodaysJournal(plugin: InkwellPlugin): Promise<void> {
  const file = await ensureTodaysJournal(plugin);
  await plugin.app.workspace.getLeaf(false).openFile(file);
  await plugin.timer.arm(file, plugin.settings.journalMinutes, false);
}

/** Append a line to a "## heading" section of today's journal (section created if missing). */
export async function appendToJournal(plugin: InkwellPlugin, heading: string, line: string): Promise<void> {
  const file = await ensureTodaysJournal(plugin);
  await plugin.app.vault.process(file, (text) => {
    const lines = text.split("\n");
    const h = lines.findIndex((l) => l.trim() === `## ${heading}`);
    if (h === -1) return text.replace(/\s*$/, "") + `\n\n## ${heading}\n${line}\n`;
    let end = lines.length;
    for (let i = h + 1; i < lines.length; i++) {
      if (/^#{1,2}\s/.test(lines[i] ?? "")) {
        end = i;
        break;
      }
    }
    let at = end;
    while (at > h + 1 && lines[at - 1]?.trim() === "") at--;
    lines.splice(at, 0, line);
    return lines.join("\n");
  });
}

/** Log a new capture or resource under "## Captures" in today's journal, if that setting is on. Never throws. */
export async function logCaptureInJournal(plugin: InkwellPlugin, file: TFile, label: string): Promise<void> {
  if (!plugin.settings.captureToJournal) return;
  try {
    const link = plugin.app.fileManager.generateMarkdownLink(file, plugin.settings.folders.journal);
    await appendToJournal(plugin, "Captures", `- ${moment().format("HH:mm")} ${link} (${label})`);
  } catch (e) {
    console.error("Inkwell: could not log capture in journal", e);
  }
}
