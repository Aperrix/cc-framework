/** Resolves the effective model for a node through the cascade: node -> workflow -> config -> default. */

import type { Node } from "../schema/node.ts";
import type { Workflow } from "../schema/workflow.ts";
import type { ResolvedConfig } from "../config/types.ts";

// ---- Types ----

export interface ResolvedModel {
  model: string;
  source: "node" | "workflow" | "config" | "default";
}

// ---- Constants ----

const DEFAULT_MODEL = "sonnet";

// ---- Main ----

/** Resolve the model for a node, walking the cascade: node -> workflow -> config -> default. */
export function resolveModel(
  node: Node,
  workflow: Workflow,
  config: ResolvedConfig,
): ResolvedModel {
  if (node.model) return { model: node.model, source: "node" };
  if (workflow.model) return { model: workflow.model, source: "workflow" };
  if (config.model) return { model: config.model, source: "config" };
  return { model: DEFAULT_MODEL, source: "default" };
}
