/** Output formatters for CLI responses. */

// ---- Run Status ----

const STATUS_ICONS: Record<string, string> = {
  completed: "\u2713",
  failed: "\u2717",
  cancelled: "\u2298",
  paused: "\u23F8",
  running: "\u27F3",
  pending: "\u25CB",
  skipped: "\u2013",
};

export function formatRunStatus(run: {
  id: string;
  status: string;
  startedAt: number;
  finishedAt?: number | null;
  workflowId?: string;
}): string {
  const icon = STATUS_ICONS[run.status] ?? "?";
  const duration = run.finishedAt
    ? `${Math.round((run.finishedAt - run.startedAt) / 1000)}s`
    : "in progress";
  return `${icon} Run ${run.id.slice(0, 8)} \u2014 ${run.status} (${duration})`;
}

// ---- Workflow List ----

export function formatWorkflowList(workflows: { name: string; source: string }[]): string {
  if (workflows.length === 0) return "No workflows found.";

  const lines = ["Available workflows:", ""];
  for (const wf of workflows) {
    const tag =
      wf.source === "embedded" ? "[built-in]" : wf.source === "global" ? "[global]" : "[project]";
    lines.push(`  ${wf.name} ${tag}`);
  }
  return lines.join("\n");
}

// ---- Node Executions ----

export function formatNodeExecution(node: {
  nodeId: string;
  status: string;
  durationMs?: number | null;
  attempt: number;
}): string {
  const icon = STATUS_ICONS[node.status] ?? "?";
  const duration = node.durationMs ? `${(node.durationMs / 1000).toFixed(1)}s` : "";
  const attempt = node.attempt > 1 ? ` (attempt ${node.attempt})` : "";
  return `  ${icon} ${node.nodeId} ${duration}${attempt}`;
}

// ---- Event Logs ----

export function formatEvent(event: {
  type: string;
  nodeId?: string | null;
  timestamp: number;
  payload?: string | null;
}): string {
  const time = new Date(event.timestamp).toISOString().slice(11, 19);
  const node = event.nodeId ? `[${event.nodeId}]` : "";
  const payload = event.payload ? ` \u2014 ${event.payload.slice(0, 200)}` : "";
  return `${time} ${event.type} ${node}${payload}`;
}

// ---- Error ----

export function formatError(message: string): string {
  return `Error: ${message}`;
}
