/** Persists workflow events to disk as JSONL for durable audit trails. */

import { appendFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createLogger } from "@cc-framework/utils";

const log = createLogger("file-logger");

export interface WorkflowFileEvent {
  type:
    | "workflow_start"
    | "workflow_complete"
    | "workflow_error"
    | "node_start"
    | "node_complete"
    | "node_skipped"
    | "node_error"
    | "node_retry";
  workflow_id: string;
  workflow_name?: string;
  step?: string;
  content?: string;
  duration_ms?: number;
  error?: string;
  ts: string;
}

function getLogPath(logDir: string, runId: string): string {
  return join(logDir, `${runId}.jsonl`);
}

export async function logFileEvent(
  logDir: string,
  runId: string,
  event: Omit<WorkflowFileEvent, "ts" | "workflow_id">,
): Promise<void> {
  const logPath = getLogPath(logDir, runId);
  try {
    await mkdir(dirname(logPath), { recursive: true });
    const fullEvent: WorkflowFileEvent = {
      ...event,
      workflow_id: runId,
      ts: new Date().toISOString(),
    };
    await appendFile(logPath, JSON.stringify(fullEvent) + "\n");
  } catch (err) {
    log.warn({ logPath, err }, "log_write_failed");
    // Never throw — logging should not break workflow execution
  }
}

// ---- Convenience functions ----

export async function logFileWorkflowStart(
  logDir: string,
  runId: string,
  workflowName: string,
): Promise<void> {
  return logFileEvent(logDir, runId, { type: "workflow_start", workflow_name: workflowName });
}

export async function logFileWorkflowComplete(
  logDir: string,
  runId: string,
  durationMs: number,
): Promise<void> {
  return logFileEvent(logDir, runId, { type: "workflow_complete", duration_ms: durationMs });
}

export async function logFileWorkflowError(
  logDir: string,
  runId: string,
  error: string,
): Promise<void> {
  return logFileEvent(logDir, runId, { type: "workflow_error", error });
}

export async function logFileNodeStart(logDir: string, runId: string, step: string): Promise<void> {
  return logFileEvent(logDir, runId, { type: "node_start", step });
}

export async function logFileNodeComplete(
  logDir: string,
  runId: string,
  step: string,
  durationMs: number,
): Promise<void> {
  return logFileEvent(logDir, runId, { type: "node_complete", step, duration_ms: durationMs });
}

export async function logFileNodeSkip(logDir: string, runId: string, step: string): Promise<void> {
  return logFileEvent(logDir, runId, { type: "node_skipped", step });
}

export async function logFileNodeError(
  logDir: string,
  runId: string,
  step: string,
  error: string,
): Promise<void> {
  return logFileEvent(logDir, runId, { type: "node_error", step, error });
}
