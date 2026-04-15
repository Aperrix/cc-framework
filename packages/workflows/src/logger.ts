/** Workflow-specific logging convenience functions built on @cc-framework/utils. */

import { createLogger, type Logger } from "@cc-framework/utils";

let cachedLog: Logger | undefined;
function getLog(): Logger {
  if (!cachedLog) cachedLog = createLogger("workflow");
  return cachedLog;
}

export function logWorkflowStart(runId: string, workflowName: string): void {
  getLog().info({ runId, workflowName }, "workflow.run_started");
}

export function logWorkflowComplete(runId: string, durationMs: number): void {
  getLog().info({ runId, durationMs }, "workflow.run_completed");
}

export function logWorkflowError(runId: string, error: string): void {
  getLog().error({ runId, error }, "workflow.run_failed");
}

export function logNodeStart(runId: string, nodeId: string, attempt: number): void {
  getLog().info({ runId, nodeId, attempt }, "workflow.node_started");
}

export function logNodeComplete(runId: string, nodeId: string, durationMs: number): void {
  getLog().info({ runId, nodeId, durationMs }, "workflow.node_completed");
}

export function logNodeSkip(runId: string, nodeId: string, reason: string): void {
  getLog().info({ runId, nodeId, reason }, "workflow.node_skipped");
}

export function logNodeError(runId: string, nodeId: string, error: string, attempt: number): void {
  getLog().error({ runId, nodeId, error, attempt }, "workflow.node_failed");
}
