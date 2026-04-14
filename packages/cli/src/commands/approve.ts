/** ccf approve <runId> <nodeId> — approve a pending approval node. */

import { approveWorkflow } from "@cc-framework/core";
import type { StoreQueries } from "@cc-framework/workflows";

export async function commandApprove(
  runId: string,
  nodeId: string,
  store: StoreQueries,
): Promise<string> {
  const result = approveWorkflow(runId, nodeId, store);
  const name = result.workflowName ? ` (${result.workflowName})` : "";
  return `Approved node "${nodeId}" in run ${runId.slice(0, 8)}${name}. Use 'ccf resume ${runId}' to continue.`;
}
