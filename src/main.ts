import { debounce, Menu, Plugin, TFile } from "obsidian";
import { DEFAULT_SETTINGS, InkwellSettings, InkwellSettingTab } from "./settings";
import { CaptureModal } from "./capture";
import { writeDefaultTemplates } from "./templates";
import { openTodaysJournal } from "./journal";
import { InboxView, INBOX_VIEW, isInboxFile, triageMenu } from "./inbox";
import { exerciseBecameStory, isExercise } from "./became";
import { KeepTheRhythm } from "./integrations/keep-the-rhythm";
import { StoryView, STORY_VIEW } from "./storyview";
import { snapshotDraft } from "./revisions";
import { promoteToLongForm } from "./promote";
import { registerHomeBlocks } from "./homeblocks";
import { openHome } from "./home";
import { pick } from "./modals";
import { formatProgress, newCodexNote, newShortStory, showStoryProgress, Story, storyForFile, storyProgress } from "./stories";
import { createPromptsBase, newPrompt, RandomPromptModal, registerPromptBlock } from "./prompts";
import { createExercise, newExercise } from "./exercise";
import { newProject, newScene, projectForFile, projectProgress } from "./projects";

export default class InkwellPlugin extends Plugin {
  settings!: InkwellSettings;
  ktr!: KeepTheRhythm;
  private statusEl: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();
    this.ktr = new KeepTheRhythm(this.app);
    this.addSettingTab(new InkwellSettingTab(this.app, this));

    // Home
    this.addCommand({ id: "open-home", name: "Open Home", callback: () => openHome(this) });
    this.addRibbonIcon("home", "Inkwell: Home", () => openHome(this));

    // Capture
    const capture = () => new CaptureModal(this.app, this).open();
    this.addCommand({ id: "quick-capture", name: "Quick capture", callback: capture });
    this.addRibbonIcon("feather", "Inkwell: quick capture", capture);

    // Inbox
    this.registerView(INBOX_VIEW, (leaf) => new InboxView(leaf, this));
    this.addCommand({ id: "open-inbox", name: "Open inbox", callback: () => this.activateInbox() });
    this.addRibbonIcon("inbox", "Inkwell: inbox", () => this.activateInbox());
    this.addCommand({
      id: "triage-capture",
      name: "Triage this capture",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        if (!isInboxFile(this, f)) return false;
        if (!checking) {
          const menu = new Menu();
          triageMenu(this, f, menu);
          const r = document.body.getBoundingClientRect();
          menu.showAtPosition({ x: r.width / 2 - 100, y: r.height / 3 });
        }
        return true;
      },
    });
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, f) => {
        if (f instanceof TFile && isInboxFile(this, f)) {
          menu.addSeparator();
          triageMenu(this, f, menu);
        }
      })
    );

    // Practice
    this.addCommand({ id: "todays-journal", name: "Open today's journal", callback: () => openTodaysJournal(this) });
    this.addCommand({ id: "new-exercise", name: "New exercise", callback: () => newExercise(this) });
    this.addCommand({
      id: "random-prompt",
      name: "Random prompt",
      callback: () => new RandomPromptModal(this, (p) => void createExercise(this, p)).open(),
    });
    this.addCommand({ id: "new-prompt", name: "New prompt", callback: () => newPrompt(this) });
    this.addCommand({
      id: "became-story",
      name: "This became a story",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        if (!isExercise(this, f)) return false;
        if (!checking) void exerciseBecameStory(this, f);
        return true;
      },
    });
    registerPromptBlock(this, (p) => void createExercise(this, p));
    this.addCommand({ id: "prompts-table", name: "Open prompts table", callback: () => createPromptsBase(this) });

    // Short form
    this.addCommand({ id: "new-short-story", name: "New short story", callback: () => newShortStory(this) });
    this.addCommand({ id: "new-project", name: "New project", callback: () => newProject(this) });
    this.addCommand({ id: "new-scene", name: "New scene", callback: () => newScene(this) });
    this.addCommand({ id: "story-progress", name: "Story progress", callback: () => showStoryProgress(this) });
    this.registerView(STORY_VIEW, (leaf) => new StoryView(leaf, this));
    this.addCommand({ id: "open-story-panel", name: "Open story panel", callback: () => this.activateView(STORY_VIEW) });
    this.addRibbonIcon("book-open", "Inkwell: story panel", () => this.activateView(STORY_VIEW));
    const storyCommand = (id: string, name: string, fn: (s: Story) => unknown) =>
      this.addCommand({
        id,
        name,
        checkCallback: (checking) => {
          const s = storyForFile(this, this.app.workspace.getActiveFile());
          if (!s) return false;
          if (!checking) void fn(s);
          return true;
        },
      });
    storyCommand("snapshot-draft", "Snapshot draft (new revision)", (s) => snapshotDraft(this, s));
    storyCommand("promote-long-form", "Promote story to long form", (s) => promoteToLongForm(this, s));
    registerHomeBlocks(this);

    this.addCommand({ id: "new-character", name: "New character", callback: () => newCodexNote(this, "character") });
    this.addCommand({ id: "new-location", name: "New location", callback: () => newCodexNote(this, "location") });

    // One key for everything new (⌘⇧N on Home)
    this.addCommand({
      id: "new",
      name: "New…",
      callback: async () => {
        const choices: [string, () => unknown][] = [
          ["Short story", () => newShortStory(this)],
          ["Project", () => newProject(this)],
          ["Scene", () => newScene(this)],
          ["Exercise", () => newExercise(this)],
          ["Exercise from a random prompt", () => new RandomPromptModal(this, (p) => void createExercise(this, p)).open()],
          ["Prompt", () => newPrompt(this)],
          ["Character", () => newCodexNote(this, "character")],
          ["Location", () => newCodexNote(this, "location")],
          ["Today's journal", () => openTodaysJournal(this)],
          ["Capture", () => new CaptureModal(this.app, this).open()],
        ];
        const c = await pick(this.app, choices, (x) => x[0], "New…");
        if (c) await c[1]();
      },
    });

    // Setup
    this.addCommand({
      id: "write-default-templates",
      name: "Write default templates",
      callback: () => writeDefaultTemplates(this.app, this.settings),
    });

    // Story progress in the status bar (desktop only; mobile has no status bar).
    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass("mod-clickable");
    this.statusEl.onClickEvent(() =>
      projectForFile(this, this.app.workspace.getActiveFile()) ? this.activateView(STORY_VIEW) : showStoryProgress(this)
    );
    const refresh = debounce(() => this.refreshStatusBar(), 1000, true);
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refreshStatusBar()));
    this.registerEvent(this.app.vault.on("modify", (f) => f instanceof TFile && refresh()));
    this.registerEvent(this.app.metadataCache.on("changed", () => refresh()));
    this.app.workspace.onLayoutReady(() => this.refreshStatusBar());
  }

  activateInbox() {
    return this.activateView(INBOX_VIEW);
  }

  async activateView(type: string) {
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(type)[0];
    if (!leaf) {
      leaf = ws.getRightLeaf(false)!;
      await leaf.setViewState({ type, active: true });
    }
    await ws.revealLeaf(leaf);
  }

  async refreshStatusBar() {
    if (!this.statusEl) return;
    const file = this.app.workspace.getActiveFile();
    const story = storyForFile(this, file);
    const project = story ? null : projectForFile(this, file);
    if (!story && !project) {
      this.statusEl.setText("");
      this.statusEl.hide();
      return;
    }
    const p = story ? await storyProgress(this, story) : await projectProgress(this, project!);
    const name = story ? story.name : project!.name;
    this.statusEl.setText(`${name} · ${formatProgress(p)}${p.status ? " · " + p.status : ""}`);
    this.statusEl.show();
  }

  async loadSettings() {
    const data = (await this.loadData()) ?? {};
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...data,
      folders: { ...DEFAULT_SETTINGS.folders, ...data.folders },
      templates: { ...DEFAULT_SETTINGS.templates, ...data.templates },
    };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
