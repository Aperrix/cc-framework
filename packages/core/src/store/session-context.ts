/** Builds cross-workflow context from a session's run history. */

import type { StoreQueries } from "./queries.ts";

// ---- Types ----

export interface SessionRunSummary {
  workflowName: string;
  status: string;
  startedAt: number;
  durationMs: number | null;
  outputs: Record<string, string>;
}

export interface SessionContext {
  sessionId: string;
  runCount: number;
  runs: SessionRunSummary[];
}

// ---- Main ----

/** Build a cross-workflow context summary from a session's run history. */
export function buildSessionContext(sessionId: string, store: StoreQueries): SessionContext {
  const sessionRuns = store.getSessionRuns(sessionId);

  const runs: SessionRunSummary[] = sessionRuns.map((run) => {
    // Get workflow name
    const wf = store.getWorkflow(run.workflowId);
    const workflowName = wf?.name ?? "unknown";

    // Get duration
    const durationMs = run.finishedAt ? run.finishedAt - run.startedAt : null;

    // Get node outputs for completed runs
    const outputs: Record<string, string> = {};
    if (run.status === "completed") {
      const nodeOutputs = store.getNodeOutputs(run.id);
      for (const [nodeId, out] of Object.entries(nodeOutputs)) {
        // Truncate long outputs to keep context manageable
        outputs[nodeId] = out.output.length > 500 ? out.output.slice(0, 500) + "..." : out.output;
      }
    }

    return { workflowName, status: run.status, startedAt: run.startedAt, durationMs, outputs };
  });

  return { sessionId, runCount: runs.length, runs };
}

/** Format a SessionContext as a human-readable string for injection into prompts. */
export function formatSessionContext(ctx: SessionContext): string {
  if (ctx.runCount === 0) return "";

  const lines = [`Session: ${ctx.runCount} prior run(s)`];

  for (const run of ctx.runs) {
    const duration = run.durationMs ? `${Math.round(run.durationMs / 1000)}s` : "in progress";
    lines.push(`  - ${run.workflowName}: ${run.status} (${duration})`);

    // Include key outputs (first 3 nodes)
    const outputEntries = Object.entries(run.outputs).slice(0, 3);
    for (const [nodeId, output] of outputEntries) {
      const preview = output.split("\n")[0].slice(0, 100);
      lines.push(`    ${nodeId}: ${preview}`);
    }
  }

  return lines.join("\n");
}
