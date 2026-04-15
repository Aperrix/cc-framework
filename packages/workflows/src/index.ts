/** Public API surface for @cc-framework/workflows. */

// ---- Defaults ----
export { DEFAULTS_DIR } from "./defaults/index.ts";

// ---- Deps (narrow config interface for the workflow engine) ----
export { WORKFLOW_DEFAULTS, type WorkflowConfig, type WorkflowPaths } from "./deps.ts";

// ---- Logging ----
export {
  logWorkflowStart,
  logWorkflowComplete,
  logWorkflowError,
  logNodeStart,
  logNodeComplete,
  logNodeSkip,
  logNodeError,
} from "./logger.ts";

export {
  logFileEvent,
  logFileWorkflowStart,
  logFileWorkflowComplete,
  logFileWorkflowError,
  logFileNodeStart,
  logFileNodeComplete,
  logFileNodeSkip,
  logFileNodeError,
  type WorkflowFileEvent,
} from "./file-logger.ts";

export {
  createLogger,
  setLogLevel,
  getLogLevel,
  setLogWriter,
  resetLogWriter,
  type Logger,
  type LogLevel,
  type LogContext,
  type LogWriter,
} from "@cc-framework/utils";

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
export {
  HOOK_EVENTS,
  HookMatcherSchema,
  NodeHooksSchema,
  type HookEvent,
  type HookMatcher,
  type NodeHooks,
} from "./schema/hooks.ts";
export {
  WorkflowRunStatusSchema,
  NodeExecutionStatusSchema,
  NodeOutputSchema,
  ApprovalContextSchema,
  isApprovalContext as isApprovalContextSchema,
  ArtifactTypeSchema,
  type WorkflowRunStatus,
  type NodeExecutionStatusZod,
  type NodeOutput,
  type ApprovalContext as ApprovalContextZod,
  type ArtifactType,
} from "./schema/workflow-run.ts";

// ---- Utils ----
export { isFilePath, isPromptFilePath, isScriptFilePath } from "./utils/file-path.ts";
export { formatDuration, parseDbTimestamp } from "./utils/duration.ts";
export { formatToolCall } from "./utils/tool-formatter.ts";
export {
  withIdleTimeout,
  IdleTimeoutError,
  DEFAULT_IDLE_TIMEOUT_MS,
} from "./utils/idle-timeout.ts";

// ---- Parser ----
export {
  parseWorkflow,
  parseWorkflowSafe,
  type ParseResult,
  type ParseError,
} from "./parser/parse-workflow.ts";

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
  sessions,
} from "./store/database.ts";
export { StoreQueries } from "./store/queries.ts";
export { createDatabaseFromUrl, isPostgresUrl } from "./store/create-database.ts";
export {
  buildSessionContext,
  formatSessionContext,
  type SessionContext,
  type SessionRunSummary,
} from "./store/session-context.ts";

// ---- Runners ----
export { runScript, installDeps, type ScriptResult } from "./runners/script-runner.ts";
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
export { evaluateCondition, checkTriggerRule } from "./executor/condition-evaluator.ts";
export { validateNodeOutput, type ValidationResult } from "./executor/validate-output.ts";
export {
  dispatchNode,
  type DispatchResult,
  type DispatchContext,
} from "./executor/node-dispatcher.ts";
export { resolveModel, expandModelAlias, type ResolvedModel } from "./executor/resolve-model.ts";

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

// ---- Isolation ----
export {
  setupIsolation,
  cleanupIsolation,
  completeIsolation,
  listWorktrees,
  cleanupOrphanedWorktrees,
  cleanupToMakeRoom,
  type IsolationEnvironment,
} from "./isolation/isolation.ts";

// ---- Router ----
export {
  resolveWorkflowByName,
  parseWorkflowInvocation,
  type WorkflowInvocation,
  type WorkflowMatch,
} from "./router.ts";

// ---- Validator ----
export {
  validateWorkflowResources,
  type ValidationIssue,
  type WorkflowValidationResult,
} from "./validator.ts";

// ---- Validation Parser ----
export {
  parseValidationResults,
  type ValidationResult as ParsedValidationResult,
} from "./validation-parser.ts";

// ---- Store Types (interface) ----
export type { IWorkflowStore, WorkflowRunRecord, NodeOutputRecord } from "./store/types.ts";

// ---- Discovery ----
export { discoverWorkflows, findWorkflow, type DiscoveredWorkflow } from "./discovery/workflows.ts";
export { resolvePromptWithConfig } from "./discovery/prompts.ts";
export { discoverScripts, findScript, type DiscoveredScript } from "./discovery/scripts.ts";
