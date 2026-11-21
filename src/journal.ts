import { moment, normalizePath, TFile } from "obsidian";
import type InkwellPlugin from "./main";
import { loadTemplate, render } from "./templates";
import { createNote } from "./util";

export async function openTodaysJournal(plugin: InkwellPlugin): Promise<void> {
  const { app, settings } = plugin;
  const date = moment().format(settings.journalDateFormat);
  const path = normalizePath(`${settings.folders.journal}/${date}.md`);
  let file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    const tpl = await loadTemplate(app, settings, "journal");
    file = await createNote(app, path, render(tpl, { date, title: date }), {
      type: "journal",
      created: date,
    });
  }
  await app.workspace.getLeaf(false).openFile(file as TFile);
}
