// packages/core/src/index.ts

// Schema
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
  TRIGGER_RULES,
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
  type TriggerRule,
  type WhenCondition,
  type Isolation,
  type Retry,
  type OutputFormat,
  type ThinkingConfig,
  type EffortLevel,
  type Sandbox,
  type InputDefinition,
} from "./schema/common.ts";
export { generateWorkflowJsonSchema } from "./schema/generate-json-schema.ts";

// Parser
export { parseWorkflow } from "./parser/parse-workflow.ts";
export { resolvePrompt } from "./parser/resolve-prompt.ts";

// DAG
export { buildDag, type DagLayer } from "./dag/build-dag.ts";

// Variables
export { substituteVariables } from "./variables/substitute.ts";

// Store
export {
  createDatabase,
  type Database,
  type RunStatus,
  type NodeExecutionStatus,
  workflows,
  runs,
  nodeExecutions,
  outputs,
  events,
  artifacts,
  isolationEnvironments,
} from "./store/database.ts";
export { StoreQueries } from "./store/queries.ts";

// Runners
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

// Executor
export { WorkflowExecutor, type RunResult } from "./executor/executor.ts";

// Events
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

// Isolation
export {
  setupIsolation,
  cleanupIsolation,
  type IsolationEnvironment,
} from "./isolation/isolation.ts";
