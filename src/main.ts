import { Notice, Plugin, setIcon } from "obsidian";
import { HiddenDirectoryController } from "./explorerPatch";
import { DEFAULT_SETTINGS, normalizeSettings, RevealSettingTab, type RevealSettings } from "./settings";

export default class RevealPlugin extends Plugin {
  public settings: RevealSettings = DEFAULT_SETTINGS;
  private controller: HiddenDirectoryController | null = null;
  private toggleRibbonEl: HTMLElement | null = null;

  public override async onload(): Promise<void> {
    await this.loadSettings();

    this.controller = new HiddenDirectoryController(this);
    await this.controller.start();

    this.addSettingTab(new RevealSettingTab(this));

    this.addCommand({
      id: "toggle-hidden-directories",
      name: "Toggle hidden directories",
      callback: async () => {
        await this.toggleHiddenDirectories();
      }
    });

    this.toggleRibbonEl = this.addRibbonIcon("eye", "Toggle hidden directories", async () => {
      await this.toggleHiddenDirectories();
    });
    this.updateToggleIcon();
  }

  public override async onunload(): Promise<void> {
    await this.controller?.stop();
    this.controller = null;
  }

  public async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    await this.controller?.applyVisibility();
    this.updateToggleIcon();
  }

  private async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...normalizeSettings(loaded)
    };
  }

  private async toggleHiddenDirectories(): Promise<void> {
    this.settings.showHiddenDirectories = !this.settings.showHiddenDirectories;
    await this.saveSettings();

    const message = this.settings.showHiddenDirectories
      ? "Reveal: hidden directories enabled"
      : "Reveal: hidden directories disabled";
    new Notice(message);
  }

  private updateToggleIcon(): void {
    if (!this.toggleRibbonEl) {
      return;
    }

    const enabled = this.settings.showHiddenDirectories;
    const icon = enabled ? "eye" : "eye-off";
    const label = enabled
      ? "Hidden directories are visible. Click to hide."
      : "Hidden directories are hidden. Click to show.";

    setIcon(this.toggleRibbonEl, icon);
    this.toggleRibbonEl.setAttribute("aria-label", label);
    this.toggleRibbonEl.setAttribute("title", label);
  }
}
