/** Parses a YAML workflow file, validates it against the schema, and resolves prompt file references. */

import { readFile } from "node:fs/promises";
import { dirname } from "node:path";

import { parse as parseYaml } from "yaml";
import { z } from "zod";

import type { Workflow } from "../schema/workflow.ts";
import type { Node } from "../schema/node.ts";
import { WorkflowSchema } from "../schema/workflow.ts";
import { NodeSchema } from "../schema/node.ts";
import { resolvePromptWithConfig } from "../discovery/prompts.ts";
import type { WorkflowConfig } from "../deps.ts";
import { toError } from "@cc-framework/utils";

/** A single parse/validation error with optional node context. */
export interface ParseError {
  nodeId?: string;
  field?: string;
  message: string;
}

/** Result of a non-throwing workflow parse. */
export interface ParseResult {
  workflow: Workflow | null;
  errors: ParseError[];
}

/**
 * Top-level schema without the nodes array — used for validating workflow-level
 * fields independently before per-node parsing.
 */
const WorkflowShellSchema = WorkflowSchema.omit({ nodes: true }).extend({
  nodes: z.array(z.unknown()).min(1),
});

/**
 * Parse a workflow YAML file and return all validation errors instead of
 * throwing on the first one. Each error carries the `nodeId` of the node
 * that caused it (when applicable).
 */
export async function parseWorkflowSafe(
  filePath: string,
  config: WorkflowConfig,
): Promise<ParseResult> {
  // --- read & parse YAML ---
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (err) {
    return {
      workflow: null,
      errors: [{ message: `Failed to read workflow file: ${toError(err).message}` }],
    };
  }

  let data: unknown;
  try {
    data = parseYaml(raw);
  } catch (err) {
    return {
      workflow: null,
      errors: [{ message: `Invalid YAML: ${toError(err).message}` }],
    };
  }

  // --- validate top-level fields (name, description, etc.) ---
  const shellResult = WorkflowShellSchema.safeParse(data);
  if (!shellResult.success) {
    return {
      workflow: null,
      errors: shellResult.error.issues.map((issue) => ({
        message: issue.message,
        field: issue.path.join(".") || undefined,
      })),
    };
  }

  const shell = shellResult.data;
  const rawNodes = shell.nodes;

  // --- parse each node individually ---
  const errors: ParseError[] = [];
  const parsedNodes: Node[] = [];

  for (const rawNode of rawNodes) {
    const nodeResult = NodeSchema.safeParse(rawNode);
    if (!nodeResult.success) {
      const hasId = rawNode != null && typeof rawNode === "object" && "id" in rawNode;
      const nodeId = hasId ? String(rawNode.id) : undefined;
      for (const issue of nodeResult.error.issues) {
        errors.push({
          nodeId,
          field: issue.path.join(".") || undefined,
          message: issue.message,
        });
      }
    } else {
      parsedNodes.push(nodeResult.data);
    }
  }

  // If any node failed schema validation, we cannot build a reliable workflow
  if (errors.length > 0) {
    return { workflow: null, errors };
  }

  // Assemble the workflow object
  // Safe assertion: shell was validated by WorkflowShellSchema (all fields except nodes),
  // and parsedNodes were individually validated by NodeSchema. Re-parsing via
  // WorkflowSchema.parse() would be redundant.
  const workflow: Workflow = { ...shell, nodes: parsedNodes } as Workflow;

  // --- resolve prompts per-node ---
  const workflowDir = dirname(filePath);

  for (const node of workflow.nodes) {
    if (node.prompt !== undefined) {
      try {
        node.prompt = await resolvePromptWithConfig(node.prompt, config, workflowDir);
      } catch (err) {
        errors.push({
          nodeId: node.id,
          field: "prompt",
          message: `Failed to resolve prompt: ${toError(err).message}`,
        });
      }
    }
    if (node.loop?.prompt !== undefined) {
      try {
        node.loop.prompt = await resolvePromptWithConfig(node.loop.prompt, config, workflowDir);
      } catch (err) {
        errors.push({
          nodeId: node.id,
          field: "loop.prompt",
          message: `Failed to resolve loop prompt: ${toError(err).message}`,
        });
      }
    }
  }

  // --- DAG validation (collect all issues) ---
  collectDagErrors(workflow, errors);

  // --- output reference validation (collect all issues) ---
  collectOutputReferenceErrors(workflow, errors);

  return {
    workflow: errors.length === 0 ? workflow : null,
    errors,
  };
}

/**
 * Load a workflow YAML file, validate it with Zod, and resolve any prompt
 * fields that reference external files (e.g. `prompt: plan.md`).
 *
 * Prompt paths are resolved relative to the workflow YAML's own directory,
 * then project prompts, then project root.
 */
export async function parseWorkflow(filePath: string, config: WorkflowConfig): Promise<Workflow> {
  const result = await parseWorkflowSafe(filePath, config);
  if (result.errors.length > 0) {
    throw new Error(
      result.errors
        .map((e) => (e.nodeId ? `Node "${e.nodeId}": ${e.message}` : e.message))
        .join("\n"),
    );
  }
  return result.workflow!;
}

/**
 * Collect DAG structure errors: duplicate IDs and invalid dependency references.
 */
function collectDagErrors(workflow: Workflow, errors: ParseError[]): void {
  const nodeIds = new Set<string>();

  // Check unique IDs
  for (const node of workflow.nodes) {
    if (nodeIds.has(node.id)) {
      errors.push({
        nodeId: node.id,
        message: `Duplicate node ID: "${node.id}"`,
      });
    }
    nodeIds.add(node.id);
  }

  // Check dependency references
  for (const node of workflow.nodes) {
    for (const dep of node.depends_on) {
      if (!nodeIds.has(dep)) {
        errors.push({
          nodeId: node.id,
          message: `Node "${node.id}" depends on "${dep}" which does not exist`,
        });
      }
    }
  }
}

/**
 * Collect errors for $nodeId.output references pointing to non-existent nodes.
 */
function collectOutputReferenceErrors(workflow: Workflow, errors: ParseError[]): void {
  const nodeIds = new Set(workflow.nodes.map((n: Node) => n.id));
  const refPattern = /\$(\w+)\.output/g;

  for (const node of workflow.nodes) {
    // Check when: conditions
    if (node.when) {
      for (const match of node.when.matchAll(refPattern)) {
        const refId = match[1];
        if (!nodeIds.has(refId)) {
          errors.push({
            nodeId: node.id,
            field: "when",
            message: `Node "${node.id}" references "$${refId}.output" in when: condition, but node "${refId}" does not exist`,
          });
        }
      }
    }

    // Check prompt: content
    if (node.prompt) {
      for (const match of node.prompt.matchAll(refPattern)) {
        const refId = match[1];
        if (!nodeIds.has(refId)) {
          errors.push({
            nodeId: node.id,
            field: "prompt",
            message: `Node "${node.id}" references "$${refId}.output" in prompt, but node "${refId}" does not exist`,
          });
        }
      }
    }

    // Check loop prompt
    if (node.loop?.prompt) {
      for (const match of node.loop.prompt.matchAll(refPattern)) {
        const refId = match[1];
        if (!nodeIds.has(refId)) {
          errors.push({
            nodeId: node.id,
            field: "loop.prompt",
            message: `Node "${node.id}" references "$${refId}.output" in loop prompt, but node "${refId}" does not exist`,
          });
        }
      }
    }

    // Check cancel reason
    if (node.cancel) {
      for (const match of node.cancel.matchAll(refPattern)) {
        const refId = match[1];
        if (!nodeIds.has(refId)) {
          errors.push({
            nodeId: node.id,
            field: "cancel",
            message: `Node "${node.id}" references "$${refId}.output" in cancel reason, but node "${refId}" does not exist`,
          });
        }
      }
    }
  }
}
