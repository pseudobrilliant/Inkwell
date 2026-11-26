import { normalizePath } from "obsidian";
import { ktrString } from "./integrations/keep-the-rhythm";
import type InkwellPlugin from "./main";
import { loadTemplate, render } from "./templates";
import { ensureFolder } from "./util";

/** Closest common parent of two folder paths ("01 - Practice/Journal" + "01 - Practice/Exercises/Writing" → "01 - Practice"). */
function commonFolder(a: string, b: string): string {
  const x = a.split("/");
  const y = b.split("/");
  const out: string[] = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const part = x[i];
    if (part === undefined || part !== y[i]) break;
    out.push(part);
  }
  return out.join("/") || a;
}

/** Open the Home dashboard, creating it from the template if it doesn't exist. Never overwrites. */
export async function openHome(plugin: InkwellPlugin): Promise<void> {
  const { app, settings } = plugin;
  const raw = settings.homeNote.endsWith(".md") ? settings.homeNote : `${settings.homeNote}.md`;
  const path = normalizePath(raw);
  let file = app.vault.getFileByPath(path);
  if (!file) {
    const tpl = await loadTemplate(app, settings, "home");
    const text = render(tpl, {
      inbox: settings.folders.inbox,
      practice: commonFolder(settings.folders.journal, settings.folders.writings),
      // A KTR filter: notes on what you read (the well) aren't your writing.
      not_resources: `!(filePath starts_with ${ktrString(normalizePath(settings.folders.resources) + "/")})`,
    });
    await ensureFolder(app, path.split("/").slice(0, -1).join("/"));
    file = await app.vault.create(path, text);
  }
  await app.workspace.getLeaf(false).openFile(file);
}
