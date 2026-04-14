import { z } from "zod";
import {
  TriggerRuleSchema,
  WhenConditionSchema,
  RetrySchema,
  OutputFormatSchema,
  SandboxSchema,
  ThinkingConfigSchema,
  EffortLevelSchema,
} from "./common.ts";

// --- Constants ---

export const CONTEXT_MODES = ["fresh", "shared"] as const;
export type ContextMode = (typeof CONTEXT_MODES)[number];

export const SCRIPT_RUNTIMES = ["bash", "bun", "uv"] as const;
export type ScriptRuntime = (typeof SCRIPT_RUNTIMES)[number];

// --- Sub-schemas ---

const LoopConfigSchema = z.object({
  prompt: z.string().min(1),
  until: z.string().min(1),
  until_bash: z.string().optional(),
  max_iterations: z.number().int().min(1).optional().default(15),
  fresh_context: z.boolean().optional().default(false),
  interactive: z.boolean().optional().default(false),
  gate_message: z.string().optional(),
});

const ApprovalConfigSchema = z.object({
  message: z.string().min(1),
  capture_response: z.boolean().optional().default(false),
  on_reject: z
    .object({
      prompt: z.string().min(1),
      max_attempts: z.number().int().min(1).max(10).optional().default(3),
    })
    .optional(),
});

// --- Node base (common properties) ---

const NodeBaseSchema = z.object({
  id: z.string().min(1),
  depends_on: z.array(z.string()).optional().default([]),
  when: WhenConditionSchema.optional(),
  trigger_rule: TriggerRuleSchema.optional().default("all_success"),
  context: z.enum(CONTEXT_MODES).optional().default("fresh"),
  idle_timeout: z.number().int().min(0).optional(),
  retry: RetrySchema.optional(),
  // AI-specific (ignored by non-AI nodes)
  provider: z.string().trim().min(1).optional(),
  model: z.string().optional(),
  systemPrompt: z.string().min(1).optional(),
  effort: EffortLevelSchema.optional(),
  thinking: ThinkingConfigSchema.optional(),
  maxBudgetUsd: z.number().positive().optional(),
  fallbackModel: z.string().min(1).optional(),
  betas: z.array(z.string().min(1)).optional(),
  output_format: OutputFormatSchema.optional(),
  allowed_tools: z.array(z.string()).optional(),
  denied_tools: z.array(z.string()).optional(),
  sandbox: SandboxSchema.optional(),
  hooks: z.record(z.string(), z.unknown()).optional(),
  mcp: z.string().min(1).optional(),
  skills: z.array(z.string().min(1)).optional(),
});

// --- Node types (exactly one must be set) ---

const NodeTypesSchema = z.object({
  prompt: z.string().min(1).optional(),
  script: z.string().min(1).optional(),
  loop: LoopConfigSchema.optional(),
  approval: ApprovalConfigSchema.optional(),
  cancel: z.string().min(1).optional(),
  // Script-specific fields (only valid when script is set)
  runtime: z.enum(SCRIPT_RUNTIMES).optional(),
  deps: z.array(z.string()).optional(),
  timeout: z.number().int().positive().optional(),
});

export const NodeSchema = NodeBaseSchema.extend(NodeTypesSchema.shape).superRefine((data, ctx) => {
  const typeFields = [data.prompt, data.script, data.loop, data.approval, data.cancel];
  const defined = typeFields.filter((t) => t !== undefined);
  if (defined.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Node must have exactly one type: prompt, script, loop, approval, or cancel",
    });
  }
  if (defined.length > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Node must have exactly one type — found multiple",
    });
  }
  // runtime and deps only valid with script
  if (data.runtime !== undefined && data.script === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "'runtime' is only valid on script nodes",
    });
  }
  if (data.deps !== undefined && data.script === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "'deps' is only valid on script nodes",
    });
  }
  if (data.timeout !== undefined && data.script === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "'timeout' is only valid on script nodes",
    });
  }
});

export type Node = z.infer<typeof NodeSchema>;
export type LoopConfig = z.infer<typeof LoopConfigSchema>;
export type ApprovalConfig = z.infer<typeof ApprovalConfigSchema>;

// --- Narrowed types for type guards ---

export type PromptNode = Node & { prompt: string };
export type ScriptNode = Node & { script: string };
export type LoopNode = Node & { loop: z.infer<typeof LoopConfigSchema> };
export type ApprovalNode = Node & { approval: z.infer<typeof ApprovalConfigSchema> };
export type CancelNode = Node & { cancel: string };

// --- Type guards ---

export function isPromptNode(node: Node): node is PromptNode {
  return node.prompt !== undefined;
}

export function isScriptNode(node: Node): node is ScriptNode {
  return node.script !== undefined;
}

export function isLoopNode(node: Node): node is LoopNode {
  return node.loop !== undefined && typeof node.loop === "object";
}

export function isApprovalNode(node: Node): node is ApprovalNode {
  return node.approval !== undefined && typeof node.approval === "object";
}

export function isCancelNode(node: Node): node is CancelNode {
  return node.cancel !== undefined;
}
