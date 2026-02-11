export interface RuntimeModules {
  fsPromises: {
    readdir(path: string, options: { withFileTypes: true }): Promise<ReadonlyArray<{ name: string; isDirectory(): boolean }>>;
  };
  path: {
    join(...parts: string[]): string;
  };
}

export function getRuntimeModules(): RuntimeModules | null {
  const runtimeRequire = (globalThis as { require?: (id: string) => unknown }).require;
  if (typeof runtimeRequire !== "function") {
    return null;
  }

  try {
    const fsPromises = runtimeRequire("node:fs/promises") as RuntimeModules["fsPromises"];
    const path = runtimeRequire("node:path") as RuntimeModules["path"];
    return { fsPromises, path };
  } catch {
    return null;
  }
}
