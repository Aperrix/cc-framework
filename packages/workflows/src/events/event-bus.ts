/** Typed event bus for workflow lifecycle events. */

import { EventEmitter } from "node:events";

import type { TerminalRunStatus } from "../constants.ts";

/** Emitted when a node begins execution. */
export interface NodeStartEvent {
  runId: string;
  nodeId: string;
  attempt: number;
}

/** Emitted when a node finishes successfully. */
export interface NodeCompleteEvent {
  runId: string;
  nodeId: string;
  output: string;
  durationMs: number;
}

/** Emitted when a node execution attempt fails. */
export interface NodeErrorEvent {
  runId: string;
  nodeId: string;
  error: string;
  attempt: number;
}

/** Emitted when a node is skipped due to an unmet `when` condition or trigger rule. */
export interface NodeSkippedEvent {
  runId: string;
  nodeId: string;
  reason: string;
}

/** Emitted after each layer completes to report overall progress. */
export interface RunProgressEvent {
  runId: string;
  completedNodes: number;
  totalNodes: number;
}

/** Emitted when an entire run reaches a terminal state. */
export interface RunDoneEvent {
  runId: string;
  status: TerminalRunStatus;
  durationMs: number;
}

/** Emitted when an approval node requires human input before continuing. */
export interface ApprovalRequestEvent {
  runId: string;
  nodeId: string;
  message: string;
}

interface EventMap {
  "node:start": [NodeStartEvent];
  "node:complete": [NodeCompleteEvent];
  "node:error": [NodeErrorEvent];
  "node:skipped": [NodeSkippedEvent];
  "run:progress": [RunProgressEvent];
  "run:done": [RunDoneEvent];
  "approval:request": [ApprovalRequestEvent];
}

/** Central event bus for subscribing to workflow execution lifecycle events. */
export class WorkflowEventBus extends EventEmitter<EventMap> {}
