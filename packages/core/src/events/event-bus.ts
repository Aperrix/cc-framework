import { EventEmitter } from "node:events";

export interface NodeStartEvent {
  runId: string;
  nodeId: string;
  attempt: number;
}

export interface NodeCompleteEvent {
  runId: string;
  nodeId: string;
  output: string;
  durationMs: number;
}

export interface NodeErrorEvent {
  runId: string;
  nodeId: string;
  error: string;
  attempt: number;
}

export interface NodeSkippedEvent {
  runId: string;
  nodeId: string;
  reason: string;
}

export interface RunProgressEvent {
  runId: string;
  completedNodes: number;
  totalNodes: number;
}

export interface RunDoneEvent {
  runId: string;
  status: "completed" | "failed" | "cancelled";
  durationMs: number;
}

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

export class WorkflowEventBus extends EventEmitter<EventMap> {}
