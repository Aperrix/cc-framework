/** Multi-stage script file discovery with runtime auto-detection. */

import { readdir } from "node:fs/promises";
import { join, basename, extname } from "node:path";

import type { ScriptRuntime } from "../constants.ts";
import type { ResolvedConfig } from "../config/types.ts";

// ---- Types ----

export interface DiscoveredScript {
  /** Script name (filename without extension). */
  name: string;
  /** Full path to the script file. */
  path: string;
  /** Auto-detected runtime based on file extension. */
  runtime: ScriptRuntime;
  /** Where the script was found. */
  source: "embedded" | "global" | "project";
}

// ---- Helpers ----

const EXTENSION_TO_RUNTIME: Record<string, ScriptRuntime> = {
  ".sh": "bash",
  ".bash": "bash",
  ".ts": "bun",
  ".js": "bun",
  ".py": "uv",
};

const SCRIPT_EXTENSIONS = new Set(Object.keys(EXTENSION_TO_RUNTIME));

async function listScriptFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && SCRIPT_EXTENSIONS.has(extname(e.name)))
      .map((e) => join(dir, e.name));
  } catch {
    return [];
  }
}

function runtimeFromPath(filePath: string): ScriptRuntime {
  return EXTENSION_TO_RUNTIME[extname(filePath)] ?? "bash";
}

// ---- Main ----

/**
 * Discover all available scripts across project and embedded sources.
 * Runtime is auto-detected from file extension: .sh/.bash → bash, .ts/.js → bun, .py → uv.
 */
export async function discoverScripts(
  config: ResolvedConfig,
  embeddedDir?: string,
): Promise<DiscoveredScript[]> {
  const byName = new Map<string, DiscoveredScript>();

  if (embeddedDir) {
    for (const path of await listScriptFiles(embeddedDir)) {
      const name = basename(path, extname(path));
      byName.set(name, { name, path, runtime: runtimeFromPath(path), source: "embedded" });
    }
  }

  for (const path of await listScriptFiles(config.paths.projectScripts)) {
    const name = basename(path, extname(path));
    byName.set(name, { name, path, runtime: runtimeFromPath(path), source: "project" });
  }

  return [...byName.values()];
}

/**
 * Find a single script by name.
 * Returns the highest-priority match (project > embedded), or null.
 */
export async function findScript(
  name: string,
  config: ResolvedConfig,
  embeddedDir?: string,
): Promise<DiscoveredScript | null> {
  const all = await discoverScripts(config, embeddedDir);
  return all.find((s) => s.name === name) ?? null;
}
