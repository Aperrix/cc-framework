// Centralized constants for cc-framework core.
// All enum-like values are defined here and derived types are exported.
// Schemas, store, runners, and executor all import from this file.

// --- Workflow definition ---

export const TRIGGER_RULES = [
  "all_success",
  "one_success",
  "none_failed_min_one_success",
  "all_done",
] as const;
export type TriggerRule = (typeof TRIGGER_RULES)[number];

export const RETRY_ERROR_MODES = ["transient", "all"] as const;
export type RetryErrorMode = (typeof RETRY_ERROR_MODES)[number];

export const ISOLATION_STRATEGIES = ["worktree", "branch"] as const;
export type IsolationStrategy = (typeof ISOLATION_STRATEGIES)[number];

export const INPUT_TYPES = ["string", "number", "boolean"] as const;
export type InputType = (typeof INPUT_TYPES)[number];

export const EFFORT_LEVELS = ["low", "medium", "high", "max"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

export const CONTEXT_MODES = ["fresh", "shared"] as const;
export type ContextMode = (typeof CONTEXT_MODES)[number];

export const SCRIPT_RUNTIMES = ["bash", "bun", "uv"] as const;
export type ScriptRuntime = (typeof SCRIPT_RUNTIMES)[number];

export const REASONING_EFFORTS = ["minimal", "low", "medium", "high", "xhigh"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export const WEB_SEARCH_MODES = ["disabled", "cached", "live"] as const;
export type WebSearchMode = (typeof WEB_SEARCH_MODES)[number];

// --- Runtime state ---

export const WORKFLOW_SOURCES = ["embedded", "custom"] as const;
export type WorkflowSource = (typeof WORKFLOW_SOURCES)[number];

export const RUN_STATUSES = [
  "pending",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const TERMINAL_RUN_STATUSES = ["completed", "failed", "cancelled"] as const;
export type TerminalRunStatus = (typeof TERMINAL_RUN_STATUSES)[number];

export const NODE_EXECUTION_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
] as const;
export type NodeExecutionStatus = (typeof NODE_EXECUTION_STATUSES)[number];

export const TERMINAL_NODE_STATUSES = ["completed", "failed", "skipped"] as const;
export type TerminalNodeStatus = (typeof TERMINAL_NODE_STATUSES)[number];

export const ISOLATION_STATUSES = ["active", "cleaned_up", "orphaned"] as const;
export type IsolationStatus = (typeof ISOLATION_STATUSES)[number];
