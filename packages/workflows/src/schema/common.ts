/** Shared Zod schemas and types reused across node and workflow definitions. */

import { z } from "zod";

import type { TriggerRule } from "../constants.ts";
import {
  TRIGGER_RULES,
  RETRY_ERROR_MODES,
  ISOLATION_STRATEGIES,
  INPUT_TYPES,
  EFFORT_LEVELS,
} from "../constants.ts";

// Re-export constants and types from centralized module
export { TRIGGER_RULES, RETRY_ERROR_MODES, ISOLATION_STRATEGIES, INPUT_TYPES, EFFORT_LEVELS };
export type { TriggerRule, EffortLevel, IsolationStrategy } from "../constants.ts";

// ---- Schemas ----

export const TriggerRuleSchema = z.enum(TRIGGER_RULES);

export const WhenConditionSchema = z.string().min(1);
export type WhenCondition = z.infer<typeof WhenConditionSchema>;

export const RetrySchema = z.object({
  max_attempts: z.number().int().min(1).max(5),
  delay_ms: z.number().int().min(1000).max(60000).optional().default(3000),
  on_error: z.enum(RETRY_ERROR_MODES).optional().default("transient"),
});
export type Retry = z.infer<typeof RetrySchema>;

export const IsolationSchema = z.object({
  strategy: z.enum(ISOLATION_STRATEGIES),
  branch_prefix: z.string().optional().default("ccf/"),
});
export type Isolation = z.infer<typeof IsolationSchema>;

export const InputDefinitionSchema = z.object({
  type: z.enum(INPUT_TYPES),
  required: z.boolean().optional().default(false),
  description: z.string().optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
});
export type InputDefinition = z.infer<typeof InputDefinitionSchema>;

export const OutputFormatSchema = z.record(z.string(), z.unknown());
export type OutputFormat = z.infer<typeof OutputFormatSchema>;

// Thinking config — adaptive | enabled (with optional budgetTokens) | disabled
export const ThinkingConfigSchema = z.union([
  z.object({ type: z.literal("adaptive") }),
  z.object({
    type: z.literal("enabled"),
    budgetTokens: z.number().int().positive().optional(),
  }),
  z.object({ type: z.literal("disabled") }),
  z.literal("adaptive"),
  z.literal("disabled"),
]);
export type ThinkingConfig = z.infer<typeof ThinkingConfigSchema>;

export const EffortLevelSchema = z.enum(EFFORT_LEVELS);

export const SandboxSchema = z.object({
  enabled: z.boolean().optional().default(false),
  autoAllowBashIfSandboxed: z.boolean().optional(),
  ignoreViolations: z.boolean().optional(),
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

// ---- Type Guards ----

const TRIGGER_RULE_SET: ReadonlySet<string> = new Set(TRIGGER_RULES);

/** Check whether an unknown value is a valid TriggerRule string. */
export function isTriggerRule(value: unknown): value is TriggerRule {
  return typeof value === "string" && TRIGGER_RULE_SET.has(value);
}
