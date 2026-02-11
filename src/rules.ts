import type { RevealSettings } from "./settings";

const PATH_SEPARATOR = "/";

export function normalizeVaultPath(path: string): string {
  return path.replace(/\\/g, PATH_SEPARATOR).replace(/^\/+/, "").replace(/\/+$/, "");
}

export function isHiddenSegment(segment: string): boolean {
  return segment.startsWith(".") && segment !== "." && segment !== "..";
}

export function containsHiddenDirectory(path: string): boolean {
  return normalizeVaultPath(path)
    .split(PATH_SEPARATOR)
    .filter(Boolean)
    .some(isHiddenSegment);
}

export function shouldRevealDirectory(path: string, settings: RevealSettings): boolean {
  const normalizedPath = normalizeVaultPath(path);
  if (!containsHiddenDirectory(normalizedPath)) {
    return false;
  }

  return !matchesAnyPattern(normalizedPath, settings.excludedPatterns);
}

export function matchesAnyPattern(path: string, patterns: readonly string[]): boolean {
  const normalizedPath = normalizeVaultPath(path);
  return patterns.some((pattern) => matchGlob(normalizedPath, pattern));
}

export function matchGlob(path: string, pattern: string): boolean {
  const normalizedPattern = normalizeVaultPath(pattern.trim());
  if (!normalizedPattern) {
    return false;
  }

  const escaped = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "::DOUBLE_STAR::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DOUBLE_STAR::/g, ".*");

  const expression = new RegExp(`^${escaped}$`);
  if (expression.test(path)) {
    return true;
  }

  if (!normalizedPattern.endsWith("/**") && !normalizedPattern.includes("*")) {
    return path === normalizedPattern || path.startsWith(`${normalizedPattern}/`);
  }

  return false;
}
