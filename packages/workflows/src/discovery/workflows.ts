/** Workflow discovery: embedded defaults → global → project. */

import { readdir } from "node:fs/promises";
import { join, basename } from "node:path";

import type { WorkflowConfig } from "../deps.ts";

// ---- Types ----

export interface DiscoveredWorkflow {
  /** Workflow name (filename without extension). */
  name: string;
  /** Full path to the YAML file. */
  path: string;
  /** Where the workflow was found. */
  source: "embedded" | "global" | "project";
}

// ---- Helpers ----

/** List .yaml/.yml files directly in a directory. Returns empty array if dir doesn't exist. */
async function listYamlFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && (e.name.endsWith(".yaml") || e.name.endsWith(".yml")))
      .map((e) => join(dir, e.name));
  } catch {
    return [];
  }
}

/** Extract workflow name from filename (strip extension). */
function nameFromPath(filePath: string): string {
  const name = basename(filePath);
  return name.replace(/\.ya?ml$/, "");
}

// ---- Main ----

/**
 * Discover all available workflows, merging three sources.
 * Later sources override earlier ones when names collide (project > global > embedded).
 */
export async function discoverWorkflows(config: WorkflowConfig): Promise<DiscoveredWorkflow[]> {
  const byName = new Map<string, DiscoveredWorkflow>();

  // Stage 1: Embedded defaults (lowest priority)
  for (const path of await listYamlFiles(config.paths.embeddedWorkflows)) {
    const name = nameFromPath(path);
    byName.set(name, { name, path, source: "embedded" });
  }

  // Stage 2: Global workflows (~/.cc-framework/workflows/)
  for (const path of await listYamlFiles(config.paths.globalWorkflows)) {
    const name = nameFromPath(path);
    byName.set(name, { name, path, source: "global" });
  }

  // Stage 3: Project workflows (.cc-framework/workflows/) — highest priority
  for (const path of await listYamlFiles(config.paths.projectWorkflows)) {
    const name = nameFromPath(path);
    byName.set(name, { name, path, source: "project" });
  }

  return [...byName.values()];
}

/**
 * Find a single workflow by name across all discovery sources.
 * Returns the highest-priority match (project > global > embedded), or null if not found.
 */
export async function findWorkflow(
  name: string,
  config: WorkflowConfig,
): Promise<DiscoveredWorkflow | null> {
  const all = await discoverWorkflows(config);
  return all.find((w) => w.name === name) ?? null;
}
