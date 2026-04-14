/** Structured logging for workflow execution. */

// ---- Types ----

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  runId?: string;
  nodeId?: string;
  durationMs?: number;
  [key: string]: unknown;
}

export type LogHandler = (entry: LogEntry) => void;

// ---- Default Handler ----

const PREFIX = "[cc-framework]";

function defaultHandler(entry: LogEntry): void {
  const parts = [PREFIX];
  if (entry.runId) parts.push(`[${entry.runId.slice(0, 8)}]`);
  if (entry.nodeId) parts.push(`[${entry.nodeId}]`);
  parts.push(entry.message);
  if (entry.durationMs !== undefined) parts.push(`(${entry.durationMs}ms)`);

  switch (entry.level) {
    case "error":
      console.error(...parts);
      break;
    case "warn":
      console.warn(...parts);
      break;
    case "debug":
      console.debug(...parts);
      break;
    default:
      console.log(...parts);
  }
}

// ---- Logger ----

let handler: LogHandler = defaultHandler;

/** Set a custom log handler (for testing or custom integrations). */
export function setLogHandler(h: LogHandler): void {
  handler = h;
}

/** Reset to the default console log handler. */
export function resetLogHandler(): void {
  handler = defaultHandler;
}

/** Emit a structured log entry. */
export function log(entry: LogEntry): void {
  handler(entry);
}

// ---- Convenience Functions ----

export function logWorkflowStart(runId: string, workflowName: string): void {
  log({ level: "info", message: `Workflow "${workflowName}" started`, runId });
}

export function logWorkflowComplete(runId: string, durationMs: number): void {
  log({ level: "info", message: "Workflow completed", runId, durationMs });
}

export function logWorkflowError(runId: string, error: string): void {
  log({ level: "error", message: `Workflow failed: ${error}`, runId });
}

export function logNodeStart(runId: string, nodeId: string, attempt: number): void {
  log({ level: "info", message: `Node started (attempt ${attempt})`, runId, nodeId });
}

export function logNodeComplete(runId: string, nodeId: string, durationMs: number): void {
  log({ level: "info", message: "Node completed", runId, nodeId, durationMs });
}

export function logNodeSkip(runId: string, nodeId: string, reason: string): void {
  log({ level: "info", message: `Node skipped: ${reason}`, runId, nodeId });
}

export function logNodeError(runId: string, nodeId: string, error: string, attempt: number): void {
  log({ level: "error", message: `Node error (attempt ${attempt}): ${error}`, runId, nodeId });
}
