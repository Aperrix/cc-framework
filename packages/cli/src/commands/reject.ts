/** ccf reject <runId> <nodeId> [--reason "..."] — reject a pending approval node. */

import { rejectWorkflow } from "@cc-framework/core";
import type { StoreQueries } from "@cc-framework/workflows";

export async function commandReject(
  runId: string,
  nodeId: string,
  reason: string | undefined,
  store: StoreQueries,
): Promise<string> {
  const result = rejectWorkflow(runId, nodeId, store, reason);
  return `Rejected node "${nodeId}" in run ${runId.slice(0, 8)}.${result.reason !== "Rejected" ? ` Reason: ${result.reason}` : ""}`;
}
