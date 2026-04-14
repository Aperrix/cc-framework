/** Prompt file resolution for workflow nodes. */

import { readFile } from "node:fs/promises";
import { join, isAbsolute } from "node:path";

import type { ResolvedConfig } from "@cc-framework/core";
import { isPromptFilePath } from "../utils/file-path.ts";

/**
 * Resolve a prompt value to its text content.
 *
 * If the value is inline text (no .md extension, no path prefix), returns it as-is.
 * If it's a file path, searches: project prompts → workflow directory → project root.
 *
 * @param workflowDir - Directory containing the workflow YAML file (for relative prompt resolution)
 */
export async function resolvePromptWithConfig(
  value: string,
  config: ResolvedConfig,
  workflowDir?: string,
): Promise<string> {
  if (!isPromptFilePath(value)) {
    return value;
  }

  if (isAbsolute(value)) {
    return readFile(value, "utf-8");
  }

  // Search order: project prompts → workflow dir → project root
  const candidates = [
    join(config.paths.projectPrompts, value),
    ...(workflowDir ? [join(workflowDir, value)] : []),
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
