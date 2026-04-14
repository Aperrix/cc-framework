/** ccf status [runId] — show run status. */

import { getWorkflowStatus } from "@cc-framework/core";
import type { StoreQueries } from "@cc-framework/workflows";
import { formatRunStatus } from "../shared/format.ts";

export async function commandStatus(
  runId: string | undefined,
  store: StoreQueries,
  sessionId: string,
): Promise<string> {
  if (runId) {
    const run = store.getRun(runId);
    if (!run) throw new Error(`Run "${runId}" not found.`);
    return formatRunStatus(run);
  }

  const { runs } = getWorkflowStatus(store, sessionId);
  if (runs.length === 0) return "No runs in current session.";

  return runs.map((r) => formatRunStatus(r)).join("\n");
}
