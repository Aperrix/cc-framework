/** Parses a YAML workflow file, validates it against the schema, and resolves prompt file references. */

import { readFile } from "node:fs/promises";

import { parse as parseYaml } from "yaml";

import type { Workflow } from "../schema/workflow.ts";
import type { Node } from "../schema/node.ts";
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

  validateOutputReferences(workflow);
  return workflow;
}

/**
 * Validate that all $nodeId.output references in the workflow
 * point to nodes that actually exist in the DAG.
 */
function validateOutputReferences(workflow: Workflow): void {
  const nodeIds = new Set(workflow.nodes.map((n: Node) => n.id));
  const refPattern = /\$(\w+)\.output/g;

  for (const node of workflow.nodes) {
    // Check when: conditions
    if (node.when) {
      for (const match of node.when.matchAll(refPattern)) {
        const refId = match[1];
        if (!nodeIds.has(refId)) {
          throw new Error(
            `Node "${node.id}" references "$${refId}.output" in when: condition, but node "${refId}" does not exist`,
          );
        }
      }
    }

    // Check prompt: content
    if (node.prompt) {
      for (const match of node.prompt.matchAll(refPattern)) {
        const refId = match[1];
        if (!nodeIds.has(refId)) {
          throw new Error(
            `Node "${node.id}" references "$${refId}.output" in prompt, but node "${refId}" does not exist`,
          );
        }
      }
    }

    // Check loop prompt
    if (node.loop?.prompt) {
      for (const match of node.loop.prompt.matchAll(refPattern)) {
        const refId = match[1];
        if (!nodeIds.has(refId)) {
          throw new Error(
            `Node "${node.id}" references "$${refId}.output" in loop prompt, but node "${refId}" does not exist`,
          );
        }
      }
    }

    // Check cancel reason
    if (node.cancel) {
      for (const match of node.cancel.matchAll(refPattern)) {
        const refId = match[1];
        if (!nodeIds.has(refId)) {
          throw new Error(
            `Node "${node.id}" references "$${refId}.output" in cancel reason, but node "${refId}" does not exist`,
          );
        }
      }
    }
  }
}
