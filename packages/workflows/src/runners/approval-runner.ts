/** Human-in-the-loop approval gate that pauses workflow execution until approved or rejected. */

import type { ApprovalConfig } from "../schema/node.ts";
import type { WorkflowEventBus } from "../events/event-bus.ts";

/** Serializable context persisted when a run is paused for approval. */
export interface ApprovalContext {
  nodeId: string;
  message: string;
  captureResponse: boolean;
  onRejectPrompt?: string;
  onRejectMaxAttempts?: number;
  rejectionCount: number;
}

/** Response from the external approval handler (MCP tool or CLI). */
export interface ApprovalResult {
  approved: boolean;
  response?: string;
}

/** Thrown to signal that the workflow should pause, not that it failed. */
export class WorkflowPausedError extends Error {
  constructor(
    public readonly nodeId: string,
    public readonly approvalContext: ApprovalContext,
  ) {
    super(`Workflow paused for approval at node "${nodeId}"`);
    this.name = "WorkflowPausedError";
  }
}

/** Type guard to validate a parsed JSON payload as an ApprovalContext. */
export function isApprovalContext(val: unknown): val is ApprovalContext {
  if (typeof val !== "object" || val === null) return false;
  if (!("nodeId" in val) || typeof val.nodeId !== "string") return false;
  if (!("message" in val) || typeof val.message !== "string") return false;
  return true;
}

/**
 * Handles an approval node by emitting the request event and throwing
 * WorkflowPausedError. The executor catches this, persists the approval
 * context, and sets the run status to "paused".
 *
 * Resume is handled externally (via MCP tool ccf_approve/ccf_reject)
 * which calls StoreQueries to update the run status and create
 * the approval response event.
 */
export function requestApproval(
  runId: string,
  nodeId: string,
  config: ApprovalConfig,
  eventBus: WorkflowEventBus,
): never {
  const approvalContext: ApprovalContext = {
    nodeId,
    message: config.message,
    captureResponse: config.capture_response ?? false,
    onRejectPrompt: config.on_reject?.prompt,
    onRejectMaxAttempts: config.on_reject?.max_attempts ?? 3,
    rejectionCount: 0,
  };

  eventBus.emit("approval:request", { runId, nodeId, message: config.message });

  throw new WorkflowPausedError(nodeId, approvalContext);
}
