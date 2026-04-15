/**
 * Shared workflow business logic — approve, reject, resume, abandon, status.
 *
 * Both CLI commands and MCP tools are thin formatting adapters over these functions.
 * Operations throw on errors; callers catch and format for their platform.
 *
 * Adapted from Archon's workflow-operations for cc-framework's StoreQueries.
 */

import type { ResolvedConfig } from "../config/types.ts";
import type { StoreQueries, WorkflowRunRecord } from "@cc-framework/workflows";
import {
  findWorkflow,
  parseWorkflow,
  WorkflowExecutor,
  WorkflowEventBus,
  isApprovalContext,
  TERMINAL_RUN_STATUSES,
} from "@cc-framework/workflows";
import { createLogger, type Logger } from "@cc-framework/utils";

// Lazy logger — never at module scope
let cachedLog: Logger | undefined;
function getLog(): Logger {
  if (!cachedLog) cachedLog = createLogger("operations");
  return cachedLog;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RESUMABLE_STATUSES: ReadonlySet<string> = new Set(["failed", "paused"]);
const TERMINAL_STATUSES: ReadonlySet<string> = new Set(TERMINAL_RUN_STATUSES);

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface WorkflowStatusResult {
  runs: Array<{
    id: string;
    workflowId: string;
    status: string;
    startedAt: number;
    arguments: string | null;
  }>;
}

export interface ApprovalResult {
  runId: string;
  workflowName: string | null;
  resumed: boolean;
}

export interface RejectionResult {
  runId: string;
  workflowName: string | null;
  reason: string;
}

export interface RunResult {
  runId: string;
  workflowName: string;
  status: string;
  nodeOutputs: Record<string, { output: string }>;
}

export interface ResumeResult {
  runId: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRunOrThrow(runId: string, store: StoreQueries, logEvent: string): WorkflowRunRecord {
  const run = store.getRun(runId);
  if (!run) {
    getLog().error({ runId }, logEvent);
    throw new Error(`Workflow run not found: ${runId}`);
  }
  return run;
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/** List all running and paused workflow runs in the current session. */
export function getWorkflowStatus(store: StoreQueries, sessionId: string): WorkflowStatusResult {
  const runs = store.getSessionRuns(sessionId);
  return { runs };
}

/** Approve a pending approval node and prepare for resume. */
export function approveWorkflow(
  runId: string,
  nodeId: string,
  store: StoreQueries,
): ApprovalResult {
  const run = getRunOrThrow(runId, store, "operations.approve_lookup_failed");

  if (run.status !== "paused") {
    throw new Error(
      `Cannot approve run with status '${run.status}'. Only paused runs can be approved.`,
    );
  }

  const approval = store.getApprovalContext(runId);
  if (!approval || !isApprovalContext(approval)) {
    throw new Error("Workflow run is paused but missing approval context.");
  }

  store.recordEvent(runId, nodeId, "approval:approved");
  store.resumeRun(runId);

  const wf = store.getWorkflow(run.workflowId);

  getLog().info({ runId, nodeId, workflowName: wf?.name }, "operations.workflow_approved");

  return {
    runId,
    workflowName: wf?.name ?? null,
    resumed: true,
  };
}

/** Reject a pending approval node. */
export function rejectWorkflow(
  runId: string,
  nodeId: string,
  store: StoreQueries,
  reason?: string,
): RejectionResult {
  const run = getRunOrThrow(runId, store, "operations.reject_lookup_failed");

  if (run.status !== "paused") {
    throw new Error(
      `Cannot reject run with status '${run.status}'. Only paused runs can be rejected.`,
    );
  }

  const rejectReason = reason ?? "Rejected";
  store.recordEvent(runId, nodeId, "approval:rejected", rejectReason);

  const wf = store.getWorkflow(run.workflowId);

  getLog().info(
    { runId, nodeId, reason: rejectReason, workflowName: wf?.name },
    "operations.workflow_rejected",
  );

  return {
    runId,
    workflowName: wf?.name ?? null,
    reason: rejectReason,
  };
}

/** Resume a failed or paused workflow run. */
export async function resumeWorkflow(
  runId: string,
  config: ResolvedConfig,
  store: StoreQueries,
  cwd: string,
): Promise<ResumeResult> {
  const run = getRunOrThrow(runId, store, "operations.resume_lookup_failed");

  if (!RESUMABLE_STATUSES.has(run.status)) {
    throw new Error(
      `Cannot resume run with status '${run.status}'. Only failed or paused runs can be resumed.`,
    );
  }

  const wf = store.getWorkflow(run.workflowId);
  if (!wf) {
    throw new Error(`Workflow for run "${runId}" not found in database.`);
  }

  const discovered = await findWorkflow(wf.name, config);
  if (!discovered) {
    throw new Error(`Workflow "${wf.name}" no longer exists on disk.`);
  }

  const workflow = await parseWorkflow(discovered.path, config);
  const eventBus = new WorkflowEventBus();
  const executor = new WorkflowExecutor(store, eventBus);

  const result = await executor.resume(workflow, runId, cwd, run.arguments ?? undefined, config);

  getLog().info(
    { runId: result.runId, status: result.status, workflowName: wf.name },
    "operations.workflow_resumed",
  );

  return { runId: result.runId, status: result.status };
}

/** Abandon (cancel) a workflow run that is not yet terminal. */
export function abandonWorkflow(runId: string, store: StoreQueries): WorkflowRunRecord {
  const run = getRunOrThrow(runId, store, "operations.abandon_lookup_failed");

  if (TERMINAL_STATUSES.has(run.status)) {
    throw new Error(`Cannot abandon run with status '${run.status}'. Run is already terminal.`);
  }

  store.updateRunStatus(runId, "cancelled");

  getLog().info({ runId }, "operations.workflow_abandoned");

  return run;
}

/** Run a workflow by name — find, parse, execute. */
export async function runWorkflow(
  workflowName: string,
  args: string | undefined,
  config: ResolvedConfig,
  store: StoreQueries,
  sessionId: string,
  cwd: string,
): Promise<RunResult> {
  const discovered = await findWorkflow(workflowName, config);
  if (!discovered) {
    throw new Error(
      `Workflow "${workflowName}" not found. Run 'ccf list' to see available workflows.`,
    );
  }

  const workflow = await parseWorkflow(discovered.path, config);
  const eventBus = new WorkflowEventBus();
  const executor = new WorkflowExecutor(store, eventBus);

  getLog().info({ workflowName: workflow.name, sessionId }, "operations.workflow_run_started");

  const result = await executor.run(workflow, cwd, args, config, sessionId);
  const nodeOutputs = store.getNodeOutputs(result.runId);

  getLog().info(
    { runId: result.runId, status: result.status, workflowName: workflow.name },
    "operations.workflow_run_completed",
  );

  return {
    runId: result.runId,
    workflowName: workflow.name,
    status: result.status,
    nodeOutputs,
  };
}
