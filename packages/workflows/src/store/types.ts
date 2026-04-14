/**
 * IWorkflowStore — trait interface for workflow persistence.
 *
 * Defines the narrow interface the workflow engine needs from the store.
 * The concrete implementation (StoreQueries) satisfies this structurally.
 * Tests and alternative backends can provide their own implementations.
 */

import type { RunStatus, NodeExecutionStatus } from "../constants.ts";

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
  // Run lifecycle
  upsertWorkflow(name: string, hash: string): string;
  createRun(workflowId: string, args?: string, sessionId?: string): string;
  getRun(runId: string): WorkflowRunRecord | null;
  updateRunStatus(runId: string, status: RunStatus, finishedAt?: number): void;
  getCompletedNodeIds(runId: string): Set<string>;

  // Node execution
  createNodeExecution(runId: string, nodeId: string): string;
  updateNodeExecution(
    executionId: string,
    status: NodeExecutionStatus,
    output?: string,
    error?: string,
    durationMs?: number,
  ): void;
  getNodeOutputs(runId: string): Record<string, NodeOutputRecord>;

  // Events
  recordEvent(runId: string, type: string, data?: Record<string, unknown>): void;

  // Session
  getActiveSession(cwd: string): { id: string } | null;
  createSession(cwd: string): string;

  // Approval
  pauseForApproval(runId: string, nodeId: string, message: string): void;
  resolveApproval(runId: string, approved: boolean, response?: string): void;
  getPendingApproval(runId: string): { nodeId: string; message: string } | null;

  // Crash recovery
  failOrphanedRuns(): void;

  // Resume
  findResumableRun(workflowName: string): { runId: string; completedNodes: Set<string> } | null;
}
