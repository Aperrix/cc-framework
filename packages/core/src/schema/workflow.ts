import { z } from "zod";
import { NodeSchema } from "./node.ts";
import {
  IsolationSchema,
  InputDefinitionSchema,
  SandboxSchema,
  ThinkingConfigSchema,
  EffortLevelSchema,
} from "./common.ts";

// Re-export constants and types from centralized module
export { REASONING_EFFORTS, WEB_SEARCH_MODES } from "../constants.ts";
export type { ReasoningEffort, WebSearchMode } from "../constants.ts";

import { REASONING_EFFORTS, WEB_SEARCH_MODES } from "../constants.ts";

export const WorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  provider: z.string().trim().min(1).optional(),
  model: z.string().optional(),
  modelReasoningEffort: z.enum(REASONING_EFFORTS).optional(),
  webSearchMode: z.enum(WEB_SEARCH_MODES).optional(),
  additionalDirectories: z.array(z.string()).optional(),
  interactive: z.boolean().optional().default(false),
  effort: EffortLevelSchema.optional(),
  thinking: ThinkingConfigSchema.optional(),
  fallbackModel: z.string().min(1).optional(),
  betas: z.array(z.string().min(1)).optional(),
  sandbox: SandboxSchema.optional(),
  isolation: IsolationSchema.optional(),
  inputs: z.record(z.string(), InputDefinitionSchema).optional(),
  nodes: z.array(NodeSchema).min(1),
});

export type Workflow = z.infer<typeof WorkflowSchema>;
