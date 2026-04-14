import type { ApprovalConfig } from "../schema/node.ts";
import type { WorkflowEventBus } from "../events/event-bus.ts";

export interface ApprovalContext {
  nodeId: string;
  message: string;
  captureResponse: boolean;
  onRejectPrompt?: string;
  onRejectMaxAttempts?: number;
  rejectionCount: number;
}

export interface ApprovalResult {
  approved: boolean;
  response?: string;
}

export class WorkflowPausedError extends Error {
  constructor(
    public readonly nodeId: string,
    public readonly approvalContext: ApprovalContext,
  ) {
    super(`Workflow paused for approval at node "${nodeId}"`);
    this.name = "WorkflowPausedError";
  }
}

export function isApprovalContext(val: unknown): val is ApprovalContext {
  return (
    typeof val === "object" &&
    val !== null &&
    typeof (val as Record<string, unknown>).nodeId === "string" &&
    typeof (val as Record<string, unknown>).message === "string"
  );
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
