/**
 * IWorkflowStore — trait interface for workflow persistence.
 *
 * Defines the narrow interface the workflow engine needs from the store.
 * The concrete implementation (StoreQueries) satisfies this structurally.
 * Tests and alternative backends can provide their own implementations.
 */

import type { RunStatus, NodeExecutionStatus } from "../constants.ts";
import type { ApprovalContext } from "../runners/approval-runner.ts";

/** Minimal run record needed by the engine. */
export interface WorkflowRunRecord {
  id: string;
  workflowId: string;
  status: RunStatus;
  arguments: string | null;
  startedAt: number;
  finishedAt: number | null;
}

/** Node output as stored in the database. */
export interface NodeOutputRecord {
  output: string;
  nodeId: string;
}

/** Interface that the workflow engine depends on for persistence. */
export interface IWorkflowStore {
  // Workflow registry
  upsertWorkflow(name: string, source: string, hash: string): string;
  getWorkflow(id: string): { id: string; name: string; source: string } | null;

  // Run lifecycle
  createRun(workflowId: string, args?: string, sessionId?: string): string;
  getRun(runId: string): WorkflowRunRecord | null;
  getRunStatus(runId: string): RunStatus | null;
  updateRunStatus(runId: string, status: RunStatus): void;
  getCompletedNodeIds(runId: string): Set<string>;

  // Node execution
  createNodeExecution(runId: string, nodeId: string, attempt: number): string;
  updateNodeExecutionStatus(id: string, status: NodeExecutionStatus, durationMs?: number): void;
  saveOutput(nodeExecutionId: string, content: string, exitCode?: number | null): string;
  getNodeOutputs(runId: string): Record<string, { output: string }>;
  completeNodeByNodeId(runId: string, nodeId: string, output?: string): void;

  // Events
  recordEvent(runId: string, nodeId: string | null, type: string, payload?: string): string;
  getEvents(runId: string): Array<{
    type: string;
    nodeId: string | null;
    timestamp: number;
    payload: string | null;
  }>;

  // Session
  getActiveSession(cwd: string): { id: string } | null;
  createSession(cwd: string): string;

  // Approval
  pauseRun(runId: string, approvalContext: ApprovalContext): void;
  resumeRun(runId: string): void;
  getApprovalContext(runId: string): Record<string, unknown> | null;

  // Activity
  updateRunActivity(runId: string): void;

  // Crash recovery
  failOrphanedRuns(): number;

  // Resume
  findResumableRun(workflowName: string): { id: string; status: string } | null;
}
