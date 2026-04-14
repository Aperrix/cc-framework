/** ccf resume <runId> — resume a paused or failed run. */

import {
  findWorkflow,
  parseWorkflow,
  WorkflowExecutor,
  WorkflowEventBus,
  type ResolvedConfig,
  type StoreQueries,
} from "@cc-framework/workflows";
import { formatRunStatus } from "../shared/format.ts";

export async function commandResume(
  runId: string,
  config: ResolvedConfig,
  store: StoreQueries,
  cwd: string,
): Promise<string> {
  const run = store.getRun(runId);
  if (!run) throw new Error(`Run "${runId}" not found.`);
  if (run.status !== "failed" && run.status !== "paused") {
    throw new Error(`Run "${runId}" is ${run.status} — can only resume failed or paused runs.`);
  }

  // Find the workflow to re-execute
  const wf = store.getWorkflow(run.workflowId);
  if (!wf) throw new Error(`Workflow for run "${runId}" not found in database.`);

  const discovered = await findWorkflow(wf.name, config);
  if (!discovered) throw new Error(`Workflow "${wf.name}" no longer exists on disk.`);

  const workflow = await parseWorkflow(discovered.path, config);
  const eventBus = new WorkflowEventBus();
  const executor = new WorkflowExecutor(store, eventBus);

  const result = await executor.resume(workflow, runId, cwd, run.arguments ?? undefined, config);

  return formatRunStatus({ id: result.runId, status: result.status, startedAt: Date.now() });
}
