/** ccf resume <runId> — resume a paused or failed run. */

import { resumeWorkflow, type ResolvedConfig } from "@cc-framework/core";
import type { StoreQueries } from "@cc-framework/workflows";
import { formatRunStatus } from "../shared/format.ts";

export async function commandResume(
  runId: string,
  config: ResolvedConfig,
  store: StoreQueries,
  cwd: string,
): Promise<string> {
  const result = await resumeWorkflow(runId, config, store, cwd);
  return formatRunStatus({ id: result.runId, status: result.status, startedAt: Date.now() });
}
