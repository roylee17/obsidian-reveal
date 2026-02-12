import { describe, expect, it } from "vitest";
import { containsHiddenDirectory, matchGlob, matchesAnyPattern, normalizeVaultPath, shouldRevealDirectory } from "./rules";
import type { RevealSettings } from "./settings";

const settings: RevealSettings = {
  showHiddenDirectories: true,
  excludedPatterns: [".git/**", ".vault-config/**", "node_modules/**"]
};

describe("normalizeVaultPath", () => {
  it("normalizes slashes", () => {
    expect(normalizeVaultPath("\\a\\.cache\\b\\")).toBe("a/.cache/b");
  });
});

describe("containsHiddenDirectory", () => {
  it("detects hidden segments", () => {
    expect(containsHiddenDirectory("a/.cache/b")).toBe(true);
    expect(containsHiddenDirectory("a/b/c")).toBe(false);
  });
});

describe("matchGlob", () => {
  it("matches wildcard patterns", () => {
    expect(matchGlob(".git/objects/ab", ".git/**")).toBe(true);
    expect(matchGlob("folder/.env", "folder/*")).toBe(true);
    expect(matchGlob("folder/a/b", "folder/*")).toBe(false);
  });

  it("treats plain patterns as prefix", () => {
    expect(matchGlob("node_modules/pkg", "node_modules")).toBe(true);
    expect(matchGlob("notes/node_modules/pkg", "node_modules")).toBe(false);
  });
});

describe("matchesAnyPattern", () => {
  it("checks pattern arrays", () => {
    expect(matchesAnyPattern(".vault-config/plugins", settings.excludedPatterns)).toBe(true);
    expect(matchesAnyPattern("notes/.cache", settings.excludedPatterns)).toBe(false);
  });
});

describe("shouldRevealDirectory", () => {
  it("reveals hidden paths unless excluded", () => {
    expect(shouldRevealDirectory("notes/.cache", settings)).toBe(true);
    expect(shouldRevealDirectory(".git/objects", settings)).toBe(false);
    expect(shouldRevealDirectory("notes/work", settings)).toBe(false);
  });
});
