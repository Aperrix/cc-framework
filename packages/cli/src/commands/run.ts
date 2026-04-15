/** ccf run <workflow> — run a workflow. */

import { runWorkflow, type ResolvedConfig, type ProgressEvent } from "@cc-framework/core";
import type { StoreQueries } from "@cc-framework/workflows";
import { formatRunStatus } from "../shared/format.ts";

/** Format a progress event for CLI output. */
function formatProgress(event: ProgressEvent): string | null {
  switch (event.type) {
    case "node:start":
      return `  \u25B6 ${event.nodeId} (attempt ${event.attempt})`;
    case "node:complete":
      return `  \u2713 ${event.nodeId} (${Math.round(event.durationMs / 1000)}s)`;
    case "node:error":
      return `  \u2717 ${event.nodeId}: ${event.error}`;
    case "node:skipped":
      return `  \u2013 ${event.nodeId}: ${event.reason}`;
    case "run:progress":
      return `  [${event.completedNodes}/${event.totalNodes}]`;
    default:
      return null;
  }
}

export async function commandRun(
  workflowName: string,
  args: string | undefined,
  config: ResolvedConfig,
  store: StoreQueries,
  sessionId: string,
  cwd: string,
): Promise<string> {
  const result = await runWorkflow(workflowName, args, config, store, sessionId, cwd, (event) => {
    const line = formatProgress(event);
    if (line) process.stderr.write(`${line}\n`);
  });

  const lines = [
    formatRunStatus({ id: result.runId, status: result.status, startedAt: Date.now() }),
  ];

  for (const [nodeId, out] of Object.entries(result.nodeOutputs)) {
    lines.push(`  ${nodeId}: ${out.output.split("\n")[0].slice(0, 100)}`);
  }

  return lines.join("\n");
}
