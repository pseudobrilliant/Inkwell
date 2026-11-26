import { describe, expect, it } from "vitest";
import type { App } from "obsidian";
import { TypewriterMode, typewriterChange } from "../src/integrations/typewriter-mode";

function fakeApp(enabled: boolean) {
  const ran: string[] = [];
  const commands = { "typewriter-mode:typewriter-mode-plugin-enable": {}, "typewriter-mode:typewriter-mode-plugin-disable": {} };
  const app = {
    plugins: { enabledPlugins: new Set(enabled ? ["typewriter-mode"] : []) },
    commands: { commands, executeCommandById: (id: string) => (ran.push(id), true) },
  } as unknown as App;
  return { app, ran };
}

describe("Typewriter Mode while writing in a block", () => {
  it("changes only when the first editor starts or the last one stops", () => {
    expect(typewriterChange(0, 1)).toBe("enable");
    expect(typewriterChange(1, 2)).toBeNull();
    expect(typewriterChange(2, 1)).toBeNull();
    expect(typewriterChange(1, 0)).toBe("disable");
    expect(typewriterChange(0, 0)).toBeNull();
  });

  it("turns Typewriter Mode on entering a block and off leaving it, in either order across editors", () => {
    const { app, ran } = fakeApp(true);
    const tm = new TypewriterMode(app);
    tm.writingInBlock(true);
    expect(ran).toEqual(["typewriter-mode:typewriter-mode-plugin-enable"]);
    // Focus moves to a block in another editor, which reports before the first one stops: stays on.
    tm.writingInBlock(true);
    tm.writingInBlock(false);
    expect(ran).toHaveLength(1);
    tm.writingInBlock(false);
    expect(ran).toEqual(["typewriter-mode:typewriter-mode-plugin-enable", "typewriter-mode:typewriter-mode-plugin-disable"]);
  });

  it("does nothing when Typewriter Mode isn't installed or enabled", () => {
    const { app, ran } = fakeApp(false);
    const tm = new TypewriterMode(app);
    tm.writingInBlock(true);
    tm.writingInBlock(false);
    expect(ran).toEqual([]);
  });
});
