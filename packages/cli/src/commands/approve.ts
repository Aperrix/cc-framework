/** ccf approve <runId> <nodeId> — approve a pending approval node. */

import type { StoreQueries } from "@cc-framework/workflows";

export async function commandApprove(
  runId: string,
  nodeId: string,
  store: StoreQueries,
): Promise<string> {
  const run = store.getRun(runId);
  if (!run) throw new Error(`Run "${runId}" not found.`);
  if (run.status !== "paused") throw new Error(`Run "${runId}" is ${run.status} — not paused.`);

  // Record approval event and resume the run
  store.recordEvent(runId, nodeId, "approval:approved");
  store.resumeRun(runId);

  return `Approved node "${nodeId}" in run ${runId.slice(0, 8)}. Use 'ccf resume ${runId}' to continue.`;
}
