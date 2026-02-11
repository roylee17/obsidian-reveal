import { Notice } from "obsidian";
import type RevealPlugin from "./main";
import { getRuntimeModules } from "./runtime";
import { isHiddenSegment, normalizeVaultPath, shouldRevealDirectory } from "./rules";

interface AdapterLike {
  basePath?: string;
  getRealPath?(path: string): string;
  getFullRealPath?(path: string): string;
  getFullPath?(path: string): string;
  reconcileDeletion?(realPath: string, path: string): Promise<void> | void;
  reconcileFolderCreation?(realPath: string, path: string): Promise<void> | void;
  reconcileFileInternal?(realPath: string, path: string): Promise<void> | void;
  reconcileFileChanged?(realPath: string, path: string, stat?: unknown): Promise<void> | void;
  fs?: {
    stat(path: string): Promise<{ isDirectory?: () => boolean; type?: string } | null>;
  };
}

export class HiddenDirectoryController {
  private readonly plugin: RevealPlugin;
  private readonly trackedHiddenDirectories = new Set<string>();
  private cleanupPatch: (() => void) | null = null;

  public constructor(plugin: RevealPlugin) {
    this.plugin = plugin;
  }

  public async start(): Promise<void> {
    const adapter = this.getAdapter();
    if (!adapter) {
      return;
    }

    this.cleanupPatch = this.patchReconcileDeletion(adapter);

    if (this.plugin.settings.showHiddenDirectories) {
      await this.showAllHiddenDirectories();
    }
  }

  public async stop(): Promise<void> {
    this.cleanupPatch?.();
    this.cleanupPatch = null;
    await this.hideTrackedHiddenDirectories();
  }

  public async applyVisibility(): Promise<void> {
    if (this.plugin.settings.showHiddenDirectories) {
      await this.showAllHiddenDirectories();
      return;
    }

    await this.hideTrackedHiddenDirectories();
  }

  private getAdapter(): AdapterLike | null {
    const adapter = this.plugin.app.vault.adapter as AdapterLike;
    if (!adapter || typeof adapter !== "object") {
      new Notice("Reveal: unsupported vault adapter.");
      return null;
    }

    if (typeof adapter.reconcileDeletion !== "function" || typeof adapter.reconcileFolderCreation !== "function") {
      new Notice("Reveal: required adapter internals are unavailable.");
      return null;
    }

    return adapter;
  }

  private patchReconcileDeletion(adapter: AdapterLike): () => void {
    const original = adapter.reconcileDeletion;
    if (typeof original !== "function") {
      return () => undefined;
    }

    adapter.reconcileDeletion = async (realPath: string, path: string): Promise<void> => {
      const normalizedPath = normalizeVaultPath(path);
      const hiddenRoot = this.getHiddenRootPath(normalizedPath);
      if (
        this.plugin.settings.showHiddenDirectories &&
        hiddenRoot !== null &&
        hiddenRoot === normalizedPath &&
        shouldRevealDirectory(hiddenRoot, this.plugin.settings)
      ) {
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

  private async showAllHiddenDirectories(): Promise<void> {
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

  private async hideTrackedHiddenDirectories(): Promise<void> {
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

  private async scanHiddenDirectories(adapter: AdapterLike): Promise<string[]> {
    const runtime = getRuntimeModules();
    if (!runtime || !adapter.basePath) {
      return [];
    }

    const queue: string[] = [""];
    const hiddenDirectories = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (typeof current !== "string") {
        continue;
      }

      const absoluteCurrent = current ? runtime.path.join(adapter.basePath, current) : adapter.basePath;
      let entries: ReadonlyArray<{ name: string; isDirectory(): boolean }>;
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

  private isExcluded(path: string): boolean {
    return this.plugin.settings.excludedPatterns.some((pattern) => {
      const normalized = normalizeVaultPath(pattern.replace(/\*\*$/, ""));
      return normalized.length > 0 && (path === normalized || path.startsWith(`${normalized}/`));
    });
  }

  private async pathExistsAsDirectory(adapter: AdapterLike, path: string): Promise<boolean> {
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

  private getFullPath(adapter: AdapterLike, path: string): string | null {
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

  private getRealPath(adapter: AdapterLike, path: string): string {
    if (typeof adapter.getRealPath === "function") {
      return adapter.getRealPath(path);
    }

    return path;
  }

  private async reconcileFolderCreation(adapter: AdapterLike, path: string): Promise<void> {
    if (typeof adapter.reconcileFolderCreation !== "function") {
      return;
    }

    const realPath = this.getRealPath(adapter, path);
    await adapter.reconcileFolderCreation(realPath, path);
  }

  private async reconcileFile(adapter: AdapterLike, path: string): Promise<void> {
    const realPath = this.getRealPath(adapter, path);
    if (typeof adapter.reconcileFileInternal === "function") {
      await adapter.reconcileFileInternal(realPath, path);
      return;
    }

    if (typeof adapter.reconcileFileChanged === "function") {
      const stat = await this.safeFileStat(adapter, path);
      await adapter.reconcileFileChanged(realPath, path, stat ?? undefined);
    }
  }

  private async reconcileDeletion(adapter: AdapterLike, path: string): Promise<void> {
    if (typeof adapter.reconcileDeletion !== "function") {
      return;
    }

    const realPath = this.getRealPath(adapter, path);
    await adapter.reconcileDeletion(realPath, path);
  }

  private async revealHiddenTree(adapter: AdapterLike, rootPath: string): Promise<void> {
    await this.reconcileFolderCreation(adapter, rootPath);

    const runtime = getRuntimeModules();
    if (!runtime || !adapter.basePath) {
      return;
    }

    const queue: string[] = [rootPath];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      const absoluteCurrent = runtime.path.join(adapter.basePath, current);
      let entries: ReadonlyArray<{ name: string; isDirectory(): boolean }>;
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

  private async safeFileStat(adapter: AdapterLike, path: string): Promise<unknown | null> {
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

  private getHiddenRootPath(path: string): string | null {
    const segments = normalizeVaultPath(path)
      .split("/")
      .filter(Boolean);
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
}
