/** Parses a YAML workflow file, validates it against the schema, and resolves prompt file references. */

import { readFile } from "node:fs/promises";

import { parse as parseYaml } from "yaml";

import type { Workflow } from "../schema/workflow.ts";
import { WorkflowSchema } from "../schema/workflow.ts";
import { resolvePromptWithConfig } from "../discovery/prompts.ts";
import type { ResolvedConfig } from "../config/types.ts";

/**
 * Load a workflow YAML file, validate it with Zod, and resolve any prompt
 * fields that reference external files (e.g. `prompt: plan.md`).
 */
export async function parseWorkflow(
  filePath: string,
  config: ResolvedConfig,
  embeddedDir?: string,
): Promise<Workflow> {
  const raw = await readFile(filePath, "utf-8");
  const data = parseYaml(raw);
  const workflow = WorkflowSchema.parse(data);

  for (const node of workflow.nodes) {
    if (node.prompt !== undefined) {
      node.prompt = await resolvePromptWithConfig(node.prompt, config, embeddedDir);
    }
    if (node.loop?.prompt !== undefined) {
      node.loop.prompt = await resolvePromptWithConfig(node.loop.prompt, config, embeddedDir);
    }
  }

  return workflow;
}
