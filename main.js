"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => RevealPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/explorerPatch.ts
var import_obsidian = require("obsidian");

// src/runtime.ts
function getRuntimeModules() {
  const runtimeRequire = globalThis.require;
  if (typeof runtimeRequire !== "function") {
    return null;
  }
  try {
    const fsPromises = runtimeRequire("node:fs/promises");
    const path = runtimeRequire("node:path");
    return { fsPromises, path };
  } catch {
    return null;
  }
}

// src/rules.ts
var PATH_SEPARATOR = "/";
function normalizeVaultPath(path) {
  return path.replace(/\\/g, PATH_SEPARATOR).replace(/^\/+/, "").replace(/\/+$/, "");
}
function isHiddenSegment(segment) {
  return segment.startsWith(".") && segment !== "." && segment !== "..";
}
function containsHiddenDirectory(path) {
  return normalizeVaultPath(path).split(PATH_SEPARATOR).filter(Boolean).some(isHiddenSegment);
}
function shouldRevealDirectory(path, settings) {
  const normalizedPath = normalizeVaultPath(path);
  if (!containsHiddenDirectory(normalizedPath)) {
    return false;
  }
  return !matchesAnyPattern(normalizedPath, settings.excludedPatterns);
}
function matchesAnyPattern(path, patterns) {
  const normalizedPath = normalizeVaultPath(path);
  return patterns.some((pattern) => matchGlob(normalizedPath, pattern));
}
function matchGlob(path, pattern) {
  const normalizedPattern = normalizeVaultPath(pattern.trim());
  if (!normalizedPattern) {
    return false;
  }
  const escaped = normalizedPattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "::DOUBLE_STAR::").replace(/\*/g, "[^/]*").replace(/::DOUBLE_STAR::/g, ".*");
  const expression = new RegExp(`^${escaped}$`);
  if (expression.test(path)) {
    return true;
  }
  if (!normalizedPattern.endsWith("/**") && !normalizedPattern.includes("*")) {
    return path === normalizedPattern || path.startsWith(`${normalizedPattern}/`);
  }
  return false;
}

// src/explorerPatch.ts
var HiddenDirectoryController = class {
  constructor(plugin) {
    this.trackedHiddenDirectories = /* @__PURE__ */ new Set();
    this.cleanupPatch = null;
    this.plugin = plugin;
  }
  async start() {
    const adapter = this.getAdapter();
    if (!adapter) {
      return;
    }
    this.cleanupPatch = this.patchReconcileDeletion(adapter);
    if (this.plugin.settings.showHiddenDirectories) {
      await this.showAllHiddenDirectories();
    }
  }
  async stop() {
    this.cleanupPatch?.();
    this.cleanupPatch = null;
    await this.hideTrackedHiddenDirectories();
  }
  async applyVisibility() {
    if (this.plugin.settings.showHiddenDirectories) {
      await this.showAllHiddenDirectories();
      return;
    }
    await this.hideTrackedHiddenDirectories();
  }
  getAdapter() {
    const adapter = this.plugin.app.vault.adapter;
    if (!adapter || typeof adapter !== "object") {
      new import_obsidian.Notice("Reveal: unsupported vault adapter.");
      return null;
    }
    if (typeof adapter.reconcileDeletion !== "function" || typeof adapter.reconcileFolderCreation !== "function") {
      new import_obsidian.Notice("Reveal: required adapter internals are unavailable.");
      return null;
    }
    return adapter;
  }
  patchReconcileDeletion(adapter) {
    const original = adapter.reconcileDeletion;
    if (typeof original !== "function") {
      return () => void 0;
    }
    adapter.reconcileDeletion = async (realPath, path) => {
      const normalizedPath = normalizeVaultPath(path);
      const hiddenRoot = this.getHiddenRootPath(normalizedPath);
      if (this.plugin.settings.showHiddenDirectories && hiddenRoot !== null && hiddenRoot === normalizedPath && shouldRevealDirectory(hiddenRoot, this.plugin.settings)) {
        const existsAsDirectory = await this.pathExistsAsDirectory(adapter, hiddenRoot);
        if (existsAsDirectory) {
          this.trackedHiddenDirectories.add(hiddenRoot);
          await this.reconcileFolderCreation(adapter, hiddenRoot);
          return;
        }
        this.trackedHiddenDirectories.delete(hiddenRoot);
      }
      await original.call(adapter, realPath, path);
    };
    return () => {
      adapter.reconcileDeletion = original;
    };
  }
  async showAllHiddenDirectories() {
    const adapter = this.getAdapter();
    if (!adapter) {
      return;
    }
    const hiddenDirectories = await this.scanHiddenDirectories(adapter);
    for (const path of hiddenDirectories) {
      this.trackedHiddenDirectories.add(path);
      await this.revealHiddenTree(adapter, path);
    }
  }
  async hideTrackedHiddenDirectories() {
    const adapter = this.getAdapter();
    if (!adapter) {
      return;
    }
    const candidates = [...this.trackedHiddenDirectories].sort((a, b) => b.length - a.length);
    for (const path of candidates) {
      await this.reconcileDeletion(adapter, path);
    }
    this.trackedHiddenDirectories.clear();
  }
  async scanHiddenDirectories(adapter) {
    const runtime = getRuntimeModules();
    if (!runtime || !adapter.basePath) {
      return [];
    }
    const queue = [""];
    const hiddenDirectories = /* @__PURE__ */ new Set();
    while (queue.length > 0) {
      const current = queue.shift();
      if (typeof current !== "string") {
        continue;
      }
      const absoluteCurrent = current ? runtime.path.join(adapter.basePath, current) : adapter.basePath;
      let entries;
      try {
        entries = await runtime.fsPromises.readdir(absoluteCurrent, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        const relativePath = normalizeVaultPath(current ? `${current}/${entry.name}` : entry.name);
        if (!relativePath) {
          continue;
        }
        if (isHiddenSegment(entry.name)) {
          if (shouldRevealDirectory(relativePath, this.plugin.settings)) {
            hiddenDirectories.add(relativePath);
          }
          continue;
        }
        if (!this.isExcluded(relativePath)) {
          queue.push(relativePath);
        }
      }
    }
    return [...hiddenDirectories].sort((a, b) => a.length - b.length);
  }
  isExcluded(path) {
    return this.plugin.settings.excludedPatterns.some((pattern) => {
      const normalized = normalizeVaultPath(pattern.replace(/\*\*$/, ""));
      return normalized.length > 0 && (path === normalized || path.startsWith(`${normalized}/`));
    });
  }
  async pathExistsAsDirectory(adapter, path) {
    const fullPath = this.getFullPath(adapter, path);
    if (!fullPath || typeof adapter.fs?.stat !== "function") {
      return false;
    }
    try {
      const stat = await adapter.fs.stat(fullPath);
      if (!stat) {
        return false;
      }
      if (typeof stat.isDirectory === "function") {
        return stat.isDirectory();
      }
      return stat.type === "directory";
    } catch {
      return false;
    }
  }
  getFullPath(adapter, path) {
    const realPath = this.getRealPath(adapter, path);
    if (typeof adapter.getFullRealPath === "function") {
      return adapter.getFullRealPath(realPath);
    }
    if (typeof adapter.getFullPath === "function") {
      return adapter.getFullPath(realPath);
    }
    if (adapter.basePath) {
      const runtime = getRuntimeModules();
      if (runtime) {
        return runtime.path.join(adapter.basePath, realPath);
      }
    }
    return null;
  }
  getRealPath(adapter, path) {
    if (typeof adapter.getRealPath === "function") {
      return adapter.getRealPath(path);
    }
    return path;
  }
  async reconcileFolderCreation(adapter, path) {
    if (typeof adapter.reconcileFolderCreation !== "function") {
      return;
    }
    const realPath = this.getRealPath(adapter, path);
    await adapter.reconcileFolderCreation(realPath, path);
  }
  async reconcileFile(adapter, path) {
    const realPath = this.getRealPath(adapter, path);
    if (typeof adapter.reconcileFileInternal === "function") {
      await adapter.reconcileFileInternal(realPath, path);
      return;
    }
    if (typeof adapter.reconcileFileChanged === "function") {
      const stat = await this.safeFileStat(adapter, path);
      await adapter.reconcileFileChanged(realPath, path, stat ?? void 0);
    }
  }
  async reconcileDeletion(adapter, path) {
    if (typeof adapter.reconcileDeletion !== "function") {
      return;
    }
    const realPath = this.getRealPath(adapter, path);
    await adapter.reconcileDeletion(realPath, path);
  }
  async revealHiddenTree(adapter, rootPath) {
    await this.reconcileFolderCreation(adapter, rootPath);
    const runtime = getRuntimeModules();
    if (!runtime || !adapter.basePath) {
      return;
    }
    const queue = [rootPath];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      const absoluteCurrent = runtime.path.join(adapter.basePath, current);
      let entries;
      try {
        entries = await runtime.fsPromises.readdir(absoluteCurrent, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const childPath = normalizeVaultPath(`${current}/${entry.name}`);
        if (!childPath || this.isExcluded(childPath)) {
          continue;
        }
        if (entry.isDirectory()) {
          await this.reconcileFolderCreation(adapter, childPath);
          queue.push(childPath);
          continue;
        }
        await this.reconcileFile(adapter, childPath);
      }
    }
  }
  async safeFileStat(adapter, path) {
    const fullPath = this.getFullPath(adapter, path);
    if (!fullPath || typeof adapter.fs?.stat !== "function") {
      return null;
    }
    try {
      return await adapter.fs.stat(fullPath);
    } catch {
      return null;
    }
  }
  getHiddenRootPath(path) {
    const segments = normalizeVaultPath(path).split("/").filter(Boolean);
    if (segments.length === 0) {
      return null;
    }
    for (let index = 0; index < segments.length; index += 1) {
      if (isHiddenSegment(segments[index])) {
        return segments.slice(0, index + 1).join("/");
      }
    }
    return null;
  }
};

// src/settings.ts
var import_obsidian2 = require("obsidian");
var DEFAULT_SETTINGS = {
  showHiddenDirectories: false,
  excludedPatterns: [".git/**", ".obsidian/**", "node_modules/**", ".venv/**"]
};
function normalizeSettings(raw) {
  const candidate = raw ?? {};
  const excludedPatterns = Array.isArray(candidate.excludedPatterns) ? candidate.excludedPatterns.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean) : DEFAULT_SETTINGS.excludedPatterns;
  return {
    showHiddenDirectories: Boolean(candidate.showHiddenDirectories),
    excludedPatterns: excludedPatterns.length > 0 ? excludedPatterns : DEFAULT_SETTINGS.excludedPatterns
  };
}
var RevealSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(plugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian2.Setting(containerEl).setName("Show hidden directories").setDesc("Display dot-folders in File Explorer.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.showHiddenDirectories);
      toggle.onChange(async (value) => {
        this.plugin.settings.showHiddenDirectories = value;
        await this.plugin.saveSettings();
      });
    });
    const initialValue = this.plugin.settings.excludedPatterns.join("\n");
    new import_obsidian2.Setting(containerEl).setName("Excluded patterns").setDesc("One glob-like pattern per line. Excluded folders are never shown.").addTextArea((textArea) => {
      textArea.setPlaceholder(".git/**\n.obsidian/**\nnode_modules/**").setValue(initialValue).onChange(async (value) => {
        this.plugin.settings.excludedPatterns = value.split("\n").map((line) => line.trim()).filter(Boolean);
        await this.plugin.saveSettings();
      });
      textArea.inputEl.rows = 6;
      textArea.inputEl.addClass("reveal-setting-hint");
    });
  }
};

// src/main.ts
var RevealPlugin = class extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.controller = null;
    this.toggleRibbonEl = null;
  }
  async onload() {
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
  async onunload() {
    await this.controller?.stop();
    this.controller = null;
  }
  async saveSettings() {
    await this.saveData(this.settings);
    await this.controller?.applyVisibility();
    this.updateToggleIcon();
  }
  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...normalizeSettings(loaded)
    };
  }
  async toggleHiddenDirectories() {
    this.settings.showHiddenDirectories = !this.settings.showHiddenDirectories;
    await this.saveSettings();
    const message = this.settings.showHiddenDirectories ? "Reveal: hidden directories enabled" : "Reveal: hidden directories disabled";
    new import_obsidian3.Notice(message);
  }
  updateToggleIcon() {
    if (!this.toggleRibbonEl) {
      return;
    }
    const enabled = this.settings.showHiddenDirectories;
    const icon = enabled ? "eye" : "eye-off";
    const label = enabled ? "Hidden directories are visible. Click to hide." : "Hidden directories are hidden. Click to show.";
    (0, import_obsidian3.setIcon)(this.toggleRibbonEl, icon);
    this.toggleRibbonEl.setAttribute("aria-label", label);
    this.toggleRibbonEl.setAttribute("title", label);
  }
};
