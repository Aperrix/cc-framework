/** Parses a YAML workflow file, validates it against the schema, and resolves prompt file references. */

import { readFile } from "node:fs/promises";

import { parse as parseYaml } from "yaml";

import type { Workflow } from "../schema/workflow.ts";
import { WorkflowSchema } from "../schema/workflow.ts";
import { resolvePrompt } from "./resolve-prompt.ts";

/**
 * Load a workflow YAML file, validate it with Zod, and resolve any prompt
 * fields that reference external files (e.g. `prompt: plan.md`).
 */
export async function parseWorkflow(filePath: string, projectRoot: string): Promise<Workflow> {
  const raw = await readFile(filePath, "utf-8");
  const data = parseYaml(raw);
  const workflow = WorkflowSchema.parse(data);

  for (const node of workflow.nodes) {
    if (node.prompt !== undefined) {
      node.prompt = await resolvePrompt(node.prompt, projectRoot);
    }
    if (node.loop?.prompt !== undefined) {
      node.loop.prompt = await resolvePrompt(node.loop.prompt, projectRoot);
    }
  }

  return workflow;
}
