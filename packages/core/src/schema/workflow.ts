import { z } from "zod";
import { NodeSchema } from "./node.ts";
import {
  IsolationSchema,
  InputDefinitionSchema,
  SandboxSchema,
  ThinkingConfigSchema,
  EffortLevelSchema,
} from "./common.ts";

export const REASONING_EFFORTS = ["minimal", "low", "medium", "high", "xhigh"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export const WEB_SEARCH_MODES = ["disabled", "cached", "live"] as const;
export type WebSearchMode = (typeof WEB_SEARCH_MODES)[number];

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
