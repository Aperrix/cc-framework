/** ccf reject <runId> <nodeId> [--reason "..."] — reject a pending approval node. */

import type { StoreQueries } from "@cc-framework/core";

export async function commandReject(
  runId: string,
  nodeId: string,
  reason: string | undefined,
  store: StoreQueries,
): Promise<string> {
  const run = store.getRun(runId);
  if (!run) throw new Error(`Run "${runId}" not found.`);
  if (run.status !== "paused") throw new Error(`Run "${runId}" is ${run.status} — not paused.`);

  store.recordEvent(runId, nodeId, "approval:rejected", reason);

  return `Rejected node "${nodeId}" in run ${runId.slice(0, 8)}.${reason ? ` Reason: ${reason}` : ""}`;
}
