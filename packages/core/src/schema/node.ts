import { z } from "zod";
import {
  TriggerRuleSchema,
  WhenConditionSchema,
  RetrySchema,
  OutputFormatSchema,
  SandboxSchema,
} from "./common.ts";

const LoopConfigSchema = z.object({
  prompt: z.string().min(1),
  until: z.string().min(1),
  max_iterations: z.number().int().min(1).default(15),
  fresh_context: z.boolean().default(false),
  interactive: z.boolean().default(false),
  gate_message: z.string().optional(),
});

const ApprovalConfigSchema = z.object({
  message: z.string().min(1),
  capture_response: z.boolean().default(false),
  on_reject: z
    .object({
      prompt: z.string().min(1),
      max_attempts: z.number().int().min(1).default(3),
    })
    .optional(),
});

const NodeBaseSchema = z.object({
  id: z.string().min(1),
  depends_on: z.array(z.string()).default([]),
  when: WhenConditionSchema.optional(),
  trigger_rule: TriggerRuleSchema.default("all_success"),
  context: z.enum(["fresh", "shared"]).default("fresh"),
  idle_timeout: z.number().int().min(0).optional(),
  retry: RetrySchema.optional(),
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
  effort: z.enum(["low", "medium", "high", "max"]).optional(),
  thinking: z.union([z.literal("adaptive"), z.literal("disabled")]).optional(),
  fallbackModel: z.string().optional(),
  betas: z.array(z.string()).optional(),
  output_format: OutputFormatSchema.optional(),
  allowed_tools: z.array(z.string()).optional(),
  denied_tools: z.array(z.string()).optional(),
  sandbox: SandboxSchema.optional(),
  hooks: z.record(z.any()).optional(),
  mcp: z.string().optional(),
  skills: z.array(z.string()).optional(),
});

const NodeTypesSchema = z.object({
  prompt: z.string().min(1).optional(),
  bash: z.string().min(1).optional(),
  loop: LoopConfigSchema.optional(),
  approval: ApprovalConfigSchema.optional(),
  cancel: z.string().min(1).optional(),
});

export const NodeSchema = NodeBaseSchema.merge(NodeTypesSchema).superRefine((data, ctx) => {
  const types = [data.prompt, data.bash, data.loop, data.approval, data.cancel];
  const defined = types.filter((t) => t !== undefined);
  if (defined.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Node must have exactly one type: prompt, bash, loop, approval, or cancel",
    });
  }
  if (defined.length > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Node must have exactly one type — found multiple",
    });
  }
});

export type Node = z.infer<typeof NodeSchema>;
export type LoopConfig = z.infer<typeof LoopConfigSchema>;
export type ApprovalConfig = z.infer<typeof ApprovalConfigSchema>;
