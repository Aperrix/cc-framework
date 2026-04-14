/** Public API surface for @cc-framework/core. */

// ---- Constants & Types ----
export * from "./constants.ts";

// ---- Schema ----
export { WorkflowSchema, type Workflow } from "./schema/workflow.ts";
export {
  NodeSchema,
  type Node,
  type LoopConfig,
  type ApprovalConfig,
  type PromptNode,
  type ScriptNode,
  type LoopNode,
  type ApprovalNode,
  type CancelNode,
  isPromptNode,
  isScriptNode,
  isLoopNode,
  isApprovalNode,
  isCancelNode,
} from "./schema/node.ts";
export {
  TriggerRuleSchema,
  IsolationSchema,
  RetrySchema,
  OutputFormatSchema,
  ThinkingConfigSchema,
  EffortLevelSchema,
  SandboxSchema,
  InputDefinitionSchema,
  WhenConditionSchema,
  isTriggerRule,
  type WhenCondition,
  type Isolation,
  type Retry,
  type OutputFormat,
  type ThinkingConfig,
  type Sandbox,
  type InputDefinition,
} from "./schema/common.ts";
export { generateWorkflowJsonSchema } from "./schema/generate-json-schema.ts";

// ---- Parser ----
export { parseWorkflow } from "./parser/parse-workflow.ts";
export { resolvePrompt } from "./parser/resolve-prompt.ts";

// ---- DAG ----
export { buildDag, type DagLayer } from "./dag/build-dag.ts";

// ---- Variables ----
export { substituteVariables } from "./variables/substitute.ts";

// ---- Store ----
export {
  createDatabase,
  type Database,
  workflows,
  runs,
  nodeExecutions,
  outputs,
  events,
  artifacts,
  isolationEnvironments,
} from "./store/database.ts";
export { StoreQueries } from "./store/queries.ts";

// ---- Runners ----
export { runScript, type ScriptResult } from "./runners/script-runner.ts";
export { runAi, type AiResult } from "./runners/ai-runner.ts";
export { runLoop, type LoopResult } from "./runners/loop-runner.ts";
export {
  requestApproval,
  WorkflowPausedError,
  isApprovalContext,
  type ApprovalContext,
  type ApprovalResult,
} from "./runners/approval-runner.ts";
export { runCancel, WorkflowCancelledError } from "./runners/cancel-runner.ts";
export { runCodeMode, extractCode, type CodeModeResult } from "./runners/code-mode-runner.ts";
export {
  classifyError,
  isRetryable,
  type ClassifiedError,
  type ErrorSeverity,
} from "./runners/error-classifier.ts";

// ---- Executor ----
export { WorkflowExecutor, type RunResult } from "./executor/executor.ts";
export { validateNodeOutput, type ValidationResult } from "./executor/validate-output.ts";

// ---- Events ----
export {
  WorkflowEventBus,
  type NodeStartEvent,
  type NodeCompleteEvent,
  type NodeErrorEvent,
  type NodeSkippedEvent,
  type RunProgressEvent,
  type RunDoneEvent,
  type ApprovalRequestEvent,
} from "./events/event-bus.ts";

// ---- Config ----
export { loadConfig, initProject, ensureGlobalHome } from "./config/loader.ts";
export { CONFIG_DEFAULTS } from "./config/types.ts";
export type { GlobalConfig, ProjectConfig, ResolvedConfig } from "./config/types.ts";

// ---- Isolation ----
export {
  setupIsolation,
  cleanupIsolation,
  listWorktrees,
  cleanupOrphanedWorktrees,
  type IsolationEnvironment,
} from "./isolation/isolation.ts";

// ---- Discovery ----

export { discoverWorkflows, findWorkflow, type DiscoveredWorkflow } from "./discovery/workflows.ts";
export {
  resolvePromptWithConfig,
  discoverPrompts,
  type DiscoveredPrompt,
} from "./discovery/prompts.ts";
export { discoverScripts, findScript, type DiscoveredScript } from "./discovery/scripts.ts";
