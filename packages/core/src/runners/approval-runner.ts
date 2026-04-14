import type { ApprovalConfig } from "../schema/node.ts";
import type { WorkflowEventBus } from "../events/event-bus.ts";

export interface ApprovalResult {
  approved: boolean;
  response?: string;
}

export function requestApproval(
  runId: string,
  nodeId: string,
  config: ApprovalConfig,
  eventBus: WorkflowEventBus,
): Promise<ApprovalResult> {
  eventBus.emit("approval:request", { runId, nodeId, message: config.message });

  return new Promise((resolve) => {
    const handler = (result: ApprovalResult) => resolve(result);
    (requestApproval as any)._pendingResolvers ??= new Map();
    (requestApproval as any)._pendingResolvers.set(`${runId}:${nodeId}`, handler);
  });
}

export function resolveApproval(runId: string, nodeId: string, result: ApprovalResult): void {
  const resolvers = (requestApproval as any)._pendingResolvers as
    | Map<string, (r: ApprovalResult) => void>
    | undefined;
  const key = `${runId}:${nodeId}`;
  const resolver = resolvers?.get(key);
  if (resolver) {
    resolver(result);
    resolvers!.delete(key);
  }
}
