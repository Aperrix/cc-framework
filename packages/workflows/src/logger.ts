/** Workflow-specific logging convenience functions built on @cc-framework/utils. */

import { createLogger } from "@cc-framework/utils";

const log = createLogger("workflow");

export function logWorkflowStart(runId: string, workflowName: string): void {
  log.info({ runId }, `Workflow "${workflowName}" started`);
}

export function logWorkflowComplete(runId: string, durationMs: number): void {
  log.info({ runId, durationMs }, "Workflow completed");
}

export function logWorkflowError(runId: string, error: string): void {
  log.error({ runId }, `Workflow failed: ${error}`);
}

export function logNodeStart(runId: string, nodeId: string, attempt: number): void {
  log.info({ runId, nodeId }, `Node started (attempt ${attempt})`);
}

export function logNodeComplete(runId: string, nodeId: string, durationMs: number): void {
  log.info({ runId, nodeId, durationMs }, "Node completed");
}

export function logNodeSkip(runId: string, nodeId: string, reason: string): void {
  log.info({ runId, nodeId }, `Node skipped: ${reason}`);
}

export function logNodeError(runId: string, nodeId: string, error: string, attempt: number): void {
  log.error({ runId, nodeId }, `Node error (attempt ${attempt}): ${error}`);
}
