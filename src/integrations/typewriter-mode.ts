/**
 * Typewriter Mode integration — the ONLY file that knows about Typewriter Mode (plugin id `typewriter-mode`).
 * Optional: when it isn't installed and enabled, nothing happens.
 *
 * While the writer is writing in a writing block, Typewriter Mode is turned on; when they leave the block, it's
 * turned off. This goes through Typewriter Mode's own "Enable/Disable typewriter mode plugin" commands, so its
 * other settings (file paths, platforms, which features are on) still apply. Those commands save its settings.
 */
import type { App } from "obsidian";

const ID = "typewriter-mode";
const ENABLE = `${ID}:typewriter-mode-plugin-enable`;
const DISABLE = `${ID}:typewriter-mode-plugin-disable`;

interface PluginsApi {
  enabledPlugins?: Set<string>;
}
interface CommandsApi {
  commands?: Record<string, unknown>;
  executeCommandById?: (id: string) => boolean;
}

/**
 * Whether Typewriter Mode should change, given how many editors were writing in a block and how many are now.
 * Counting, rather than a single flag, means the order two editors report a focus change in doesn't matter.
 */
export function typewriterChange(before: number, after: number): "enable" | "disable" | null {
  if (before === 0 && after > 0) return "enable";
  if (before > 0 && after === 0) return "disable";
  return null;
}

export class TypewriterMode {
  private writers = 0;

  constructor(private app: App) {}

  /** One editor started (true) or stopped (false) writing in a block. */
  writingInBlock(writing: boolean): void {
    const before = this.writers;
    this.writers = Math.max(0, before + (writing ? 1 : -1));
    const change = typewriterChange(before, this.writers);
    if (change) this.run(change === "enable" ? ENABLE : DISABLE);
  }

  private run(id: string): void {
    const plugins = (this.app as unknown as { plugins?: PluginsApi }).plugins;
    if (!plugins?.enabledPlugins?.has(ID)) return;
    const commands = (this.app as unknown as { commands?: CommandsApi }).commands;
    if (!commands?.commands?.[id]) return;
    commands.executeCommandById?.(id);
  }
}
