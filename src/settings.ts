import { PluginSettingTab, Setting } from "obsidian";
import type RevealPlugin from "./main";

export interface RevealSettings {
  showHiddenDirectories: boolean;
  excludedPatterns: string[];
}

function normalizeConfigDir(configDir: string): string {
  const normalized = configDir.trim().replace(/^\/+|\/+$/g, "");
  return normalized.length > 0 ? normalized : ".config";
}

export function createDefaultSettings(configDir: string): RevealSettings {
  const normalizedConfigDir = normalizeConfigDir(configDir);
  return {
    showHiddenDirectories: false,
    excludedPatterns: [".git/**", `${normalizedConfigDir}/**`, "node_modules/**", ".venv/**"]
  };
}

export function normalizeSettings(raw: unknown, defaults: RevealSettings): RevealSettings {
  const candidate = (raw ?? {}) as Partial<RevealSettings>;
  const excludedPatterns = Array.isArray(candidate.excludedPatterns)
    ? candidate.excludedPatterns.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : defaults.excludedPatterns;

  return {
    showHiddenDirectories: Boolean(candidate.showHiddenDirectories),
    excludedPatterns: excludedPatterns.length > 0 ? excludedPatterns : defaults.excludedPatterns
  };
}

export class RevealSettingTab extends PluginSettingTab {
  private readonly plugin: RevealPlugin;

  public constructor(plugin: RevealPlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  public display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Show hidden directories")
      .setDesc("Display dot-folders in the file explorer.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.showHiddenDirectories);
        toggle.onChange(async (value) => {
          this.plugin.settings.showHiddenDirectories = value;
          await this.plugin.saveSettings();
        });
      });

    const initialValue = this.plugin.settings.excludedPatterns.join("\n");
    new Setting(containerEl)
      .setName("Excluded patterns")
      .setDesc("One glob-like pattern per line. Excluded folders are never shown.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder(`.git/**\n${this.plugin.app.vault.configDir}/**\nnode_modules/**`)
          .setValue(initialValue)
          .onChange(async (value) => {
            this.plugin.settings.excludedPatterns = value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          });
        textArea.inputEl.rows = 6;
        textArea.inputEl.addClass("reveal-setting-hint");
      });
  }
}
