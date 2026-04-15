/** Public API surface for @cc-framework/core. */

// ---- Config ----
export { loadConfig, initProject, ensureGlobalHome } from "./config/loader.ts";
export {
  CONFIG_DEFAULTS,
  toSafeConfig,
  GlobalConfigSchema,
  ProjectConfigSchema,
} from "./config/types.ts";
export type {
  EffortLevel,
  IsolationStrategy,
  GlobalConfig,
  ProjectConfig,
  ResolvedConfig,
  SafeConfig,
} from "./config/types.ts";

// ---- Store Adapter ----
export { toWorkflowConfig } from "./store-adapter.ts";

// ---- Session State Machine ----
export {
  shouldCreateNewSession,
  shouldDeactivateSession,
  detectPlanToExecuteTransition,
  getTriggerForCommand,
  type TransitionTrigger,
  type DeactivatingCommand,
} from "./state/session-transitions.ts";

// ---- Workflow Operations ----
export {
  runWorkflow,
  getWorkflowStatus,
  approveWorkflow,
  rejectWorkflow,
  resumeWorkflow,
  abandonWorkflow,
  type RunResult,
  type ProgressEvent,
  type WorkflowStatusResult,
  type ApprovalResult,
  type RejectionResult,
  type ResumeResult,
} from "./operations/workflow-operations.ts";

// ---- Cleanup ----
export { runCleanup, type CleanupResult } from "./operations/cleanup.ts";

// ---- Prompt Builder ----
export { buildRoutingPrompt, formatWorkflowSection } from "./orchestrator/prompt-builder.ts";

// ---- Orchestrator ----
export {
  handleMessage,
  handleSessionTransition,
  dispatchWorkflow,
  resolveWorkflowFuzzy,
  type OrchestratorContext,
  type HandleResult,
} from "./orchestrator/orchestrator.ts";
