/**
 * A minimal stand-in for the `obsidian` module, enough to load Inkwell's modules in Node.
 * Classes used with `instanceof` (TFile, TFolder) are real here; UI classes are empty shells.
 * The in-memory vault in fake-app.ts builds its files from these same classes.
 */
import moment from "moment";

export { moment };

export function normalizePath(path: string): string {
  const p = path.replace(/[\\/]+/g, "/").replace(/^\/+|\/+$/g, "").normalize("NFC");
  return p === "" ? "/" : p;
}

export function debounce<T extends unknown[]>(fn: (...args: T) => unknown) {
  const d = (...args: T) => void fn(...args);
  d.cancel = () => d;
  d.run = () => undefined;
  return d;
}

export abstract class TAbstractFile {
  path = "";
  name = "";
  parent: TFolder | null = null;
}

export class TFile extends TAbstractFile {
  stat = { ctime: 0, mtime: 0, size: 0 };
  get basename() {
    return this.name.replace(/\.[^.]*$/, "");
  }
  get extension() {
    const m = this.name.match(/\.([^.]*)$/);
    return m?.[1] ?? "";
  }
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
  isRoot() {
    return this.path === "/";
  }
}

export class Notice {
  static messages: string[] = [];
  constructor(message: string) {
    Notice.messages.push(message);
  }
  setMessage() {
    return this;
  }
  hide() {}
}

class Shell {
  constructor(..._args: unknown[]) {}
}
export class Component extends Shell {
  load() {}
  onload() {}
  unload() {}
  addChild<T>(c: T) {
    return c;
  }
  register() {}
  registerEvent() {}
  registerInterval(id: number) {
    return id;
  }
}
export class Plugin extends Component {}
export class MarkdownRenderChild extends Component {
  constructor(public containerEl: HTMLElement) {
    super();
  }
}
export class Modal extends Shell {}
export class SuggestModal extends Shell {}
export class FuzzySuggestModal extends Shell {}
export class ItemView extends Component {}
export class MarkdownView extends Component {}
export class PluginSettingTab extends Shell {}
export class Setting extends Shell {}
export class Menu extends Shell {}
export class WorkspaceLeaf extends Shell {}
export class App extends Shell {}
export const MarkdownRenderer = { render: async () => undefined };
export const Platform = { isMobile: false, isDesktop: true };
export function setIcon() {}
