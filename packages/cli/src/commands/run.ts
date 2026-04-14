/** ccf run <workflow> — run a workflow. */

import {
  findWorkflow,
  parseWorkflow,
  WorkflowExecutor,
  WorkflowEventBus,
  type ResolvedConfig,
  type StoreQueries,
  logWorkflowStart,
  logWorkflowComplete,
  logWorkflowError,
} from "@cc-framework/workflows";
import { formatRunStatus } from "../shared/format.ts";

export async function commandRun(
  workflowName: string,
  args: string | undefined,
  config: ResolvedConfig,
  store: StoreQueries,
  sessionId: string,
  cwd: string,
): Promise<string> {
  // 1. Find the workflow
  const discovered = await findWorkflow(workflowName, config);
  if (!discovered) {
    throw new Error(
      `Workflow "${workflowName}" not found. Run 'ccf list' to see available workflows.`,
    );
  }

  // 2. Parse
  const workflow = await parseWorkflow(discovered.path, config);

  // 3. Execute
  const eventBus = new WorkflowEventBus();
  const executor = new WorkflowExecutor(store, eventBus);

  logWorkflowStart("", workflow.name);

  const result = await executor.run(workflow, cwd, args, config, sessionId);

  // 4. Format result
  if (result.status === "completed") {
    logWorkflowComplete(result.runId, 0);
  } else {
    logWorkflowError(result.runId, result.status);
  }

  const lines = [
    formatRunStatus({ id: result.runId, status: result.status, startedAt: Date.now() }),
  ];

  // Show node outputs
  const nodeOutputs = store.getNodeOutputs(result.runId);
  for (const [nodeId, out] of Object.entries(nodeOutputs)) {
    lines.push(`  ${nodeId}: ${out.output.split("\n")[0].slice(0, 100)}`);
  }

  return lines.join("\n");
}
