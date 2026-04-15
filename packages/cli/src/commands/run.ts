/** ccf run <workflow> — run a workflow. */

import { runWorkflow, type ResolvedConfig } from "@cc-framework/core";
import type { StoreQueries } from "@cc-framework/workflows";
import { formatRunStatus } from "../shared/format.ts";

export async function commandRun(
  workflowName: string,
  args: string | undefined,
  config: ResolvedConfig,
  store: StoreQueries,
  sessionId: string,
  cwd: string,
): Promise<string> {
  const result = await runWorkflow(workflowName, args, config, store, sessionId, cwd);

  const lines = [
    formatRunStatus({ id: result.runId, status: result.status, startedAt: Date.now() }),
  ];

  for (const [nodeId, out] of Object.entries(result.nodeOutputs)) {
    lines.push(`  ${nodeId}: ${out.output.split("\n")[0].slice(0, 100)}`);
  }

  return lines.join("\n");
}
