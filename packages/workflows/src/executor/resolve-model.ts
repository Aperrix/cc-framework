/** Resolves the effective model for a node through the cascade: node -> workflow -> config -> default. */

import type { Node } from "../schema/node.ts";
import type { Workflow } from "../schema/workflow.ts";
import type { WorkflowConfig } from "../deps.ts";

// ---- Types ----

export interface ResolvedModel {
  model: string;
  source: "node" | "workflow" | "config" | "default";
}

// ---- Constants ----

const DEFAULT_MODEL = "sonnet";

/** Known shorthand aliases → full model identifiers. */
const MODEL_ALIASES: Record<string, string> = {
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-6",
  haiku: "claude-haiku-4-5-20251001",
};

/** Expand a model alias to its full name, or return as-is if not an alias. */
export function expandModelAlias(model: string): string {
  return MODEL_ALIASES[model.toLowerCase()] ?? model;
}

// ---- Main ----

/** Resolve the model for a node, walking the cascade: node -> workflow -> config -> default. */
export function resolveModel(
  node: Node,
  workflow: Workflow,
  config: WorkflowConfig,
): ResolvedModel {
  if (node.model) return { model: expandModelAlias(node.model), source: "node" };
  if (workflow.model) return { model: expandModelAlias(workflow.model), source: "workflow" };
  if (config.model) return { model: expandModelAlias(config.model), source: "config" };
  return { model: expandModelAlias(DEFAULT_MODEL), source: "default" };
}
