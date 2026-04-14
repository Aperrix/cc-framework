/** Multi-stage prompt file discovery and resolution. */

import { readdir, readFile } from "node:fs/promises";
import { join, basename, isAbsolute } from "node:path";

import type { ResolvedConfig } from "../config/types.ts";
import { isPromptFilePath } from "../utils/file-path.ts";

// ---- Types ----

export interface DiscoveredPrompt {
  /** Prompt name (filename without extension). */
  name: string;
  /** Full path to the markdown file. */
  path: string;
  /** Where the prompt was found. */
  source: "embedded" | "global" | "project";
}

// ---- Helpers ----

async function listMdFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => join(dir, e.name));
  } catch {
    return [];
  }
}

// ---- Main ----

/**
 * Resolve a prompt value to its text content using config-aware discovery.
 *
 * If the value is inline text (no .md extension, no path prefix), returns it as-is.
 * If it's a file path, searches: project prompts → embedded prompts → relative to project root.
 */
export async function resolvePromptWithConfig(
  value: string,
  config: ResolvedConfig,
  embeddedDir?: string,
): Promise<string> {
  if (!isPromptFilePath(value)) {
    return value;
  }

  if (isAbsolute(value)) {
    return readFile(value, "utf-8");
  }

  // Search order: project prompts → embedded prompts → relative to project root
  const candidates = [
    join(config.paths.projectPrompts, value),
    ...(embeddedDir ? [join(embeddedDir, value)] : []),
    join(config.paths.projectRoot, value),
  ];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf-8");
    } catch {
      continue;
    }
  }

  throw new Error(`Prompt file not found: "${value}" (searched in ${candidates.join(", ")})`);
}

/** Discover all available prompt files across all sources. */
export async function discoverPrompts(
  config: ResolvedConfig,
  embeddedDir?: string,
): Promise<DiscoveredPrompt[]> {
  const byName = new Map<string, DiscoveredPrompt>();

  if (embeddedDir) {
    for (const path of await listMdFiles(embeddedDir)) {
      const name = basename(path, ".md");
      byName.set(name, { name, path, source: "embedded" });
    }
  }

  for (const path of await listMdFiles(config.paths.projectPrompts)) {
    const name = basename(path, ".md");
    byName.set(name, { name, path, source: "project" });
  }

  return [...byName.values()];
}
