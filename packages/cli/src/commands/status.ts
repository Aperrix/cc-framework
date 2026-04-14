/** ccf status [runId] — show run status. */

import type { StoreQueries } from "@cc-framework/core";
import { formatRunStatus } from "../shared/format.ts";

export async function commandStatus(
  runId: string | undefined,
  store: StoreQueries,
  sessionId: string,
): Promise<string> {
  if (runId) {
    // Specific run
    const run = store.getRun(runId);
    if (!run) throw new Error(`Run "${runId}" not found.`);
    return formatRunStatus(run);
  }

  // List recent runs in session
  const runs = store.getSessionRuns(sessionId);
  if (runs.length === 0) return "No runs in current session.";

  return runs.map((r) => formatRunStatus(r)).join("\n");
}
