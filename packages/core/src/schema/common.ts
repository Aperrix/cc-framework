import { z } from "zod";

export const TriggerRuleSchema = z.enum([
  "all_success",
  "one_success",
  "none_failed_min_one_success",
  "all_done",
]);
export type TriggerRule = z.infer<typeof TriggerRuleSchema>;

export const WhenConditionSchema = z.string().min(1);
export type WhenCondition = z.infer<typeof WhenConditionSchema>;

export const RetrySchema = z.object({
  max_attempts: z.number().int().min(1),
  delay_ms: z.number().int().min(0).default(3000),
  on_error: z.enum(["transient", "all"]).default("transient"),
});
export type Retry = z.infer<typeof RetrySchema>;

export const IsolationSchema = z.object({
  strategy: z.enum(["worktree", "branch"]),
  branch_prefix: z.string().default("ccf/"),
});
export type Isolation = z.infer<typeof IsolationSchema>;

export const InputDefinitionSchema = z.object({
  type: z.enum(["string", "number", "boolean"]),
  required: z.boolean().default(false),
  description: z.string().optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
});
export type InputDefinition = z.infer<typeof InputDefinitionSchema>;

export const OutputFormatSchema = z.object({
  type: z.literal("object"),
  properties: z.record(z.any()),
  required: z.array(z.string()).optional(),
});
export type OutputFormat = z.infer<typeof OutputFormatSchema>;

export const SandboxSchema = z.object({
  enabled: z.boolean().default(false),
  filesystem: z
    .object({
      denyWrite: z.array(z.string()).optional(),
    })
    .optional(),
  network: z
    .object({
      allowedDomains: z.array(z.string()).optional(),
      allowManagedDomainsOnly: z.boolean().optional(),
    })
    .optional(),
});
export type Sandbox = z.infer<typeof SandboxSchema>;
