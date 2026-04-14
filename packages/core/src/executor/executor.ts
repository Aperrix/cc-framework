import { createHash } from "node:crypto";
import { buildDag } from "../dag/build-dag.ts";
import { substituteVariables } from "../variables/substitute.ts";
import { runShell } from "../runners/shell-runner.ts";
import { runAi } from "../runners/ai-runner.ts";
import { runLoop } from "../runners/loop-runner.ts";
import { requestApproval } from "../runners/approval-runner.ts";
import { runCancel, WorkflowCancelledError } from "../runners/cancel-runner.ts";
import type { StoreQueries } from "../store/queries.ts";
import type { WorkflowEventBus } from "../events/event-bus.ts";
import type { Workflow } from "../schema/workflow.ts";
import type { Node } from "../schema/node.ts";

export interface RunResult {
  runId: string;
  status: "completed" | "failed" | "cancelled" | "paused";
}

/**
 * Evaluates a `when` condition string against collected node outputs.
 *
 * Supports:
 *   - `$nodeId.output.field == 'value'` (with ==, !=, >, >=, <, <=)
 *   - `$nodeId.output == 'value'`
 *   - Compound conditions with && and || (&& binds tighter than ||)
 *
 * Returns false for invalid/unparseable expressions.
 */
export function evaluateWhen(
  condition: string,
  nodeOutputs: Record<string, { output: string }>,
): boolean {
  try {
    // Split on || first, then && within each group (giving && higher precedence)
    const orGroups = condition.split("||").map((s) => s.trim());
    return orGroups.some((group) => {
      const andClauses = group.split("&&").map((s) => s.trim());
      return andClauses.every((clause) => evaluateSingleCondition(clause, nodeOutputs));
    });
  } catch {
    return false;
  }
}

function evaluateSingleCondition(
  clause: string,
  nodeOutputs: Record<string, { output: string }>,
): boolean {
  // Match: $nodeId.output.field OP 'value' or $nodeId.output OP 'value'
  const match = clause.match(/^\$(\w+)\.output(?:\.(\w+))?\s*(==|!=|>=?|<=?)\s*'([^']*)'$/);
  if (!match) return false;

  const [, nodeId, field, operator, expected] = match;
  const nodeOutput = nodeOutputs[nodeId];
  if (!nodeOutput) return false;

  let actual: string;
  if (field) {
    try {
      const parsed = JSON.parse(nodeOutput.output);
      actual = parsed[field] !== undefined ? String(parsed[field]) : "";
    } catch {
      return false;
    }
  } else {
    actual = nodeOutput.output.trim();
  }

  switch (operator) {
    case "==":
      return actual === expected;
    case "!=":
      return actual !== expected;
    case ">":
      return Number(actual) > Number(expected);
    case ">=":
      return Number(actual) >= Number(expected);
    case "<":
      return Number(actual) < Number(expected);
    case "<=":
      return Number(actual) <= Number(expected);
    default:
      return false;
  }
}

export class WorkflowExecutor {
  constructor(
    private store: StoreQueries,
    private eventBus: WorkflowEventBus,
  ) {}

  async run(workflow: Workflow, cwd: string, args?: string): Promise<RunResult> {
    const startTime = Date.now();

    // 1. Persist workflow and create run
    const yamlHash = createHash("sha256").update(JSON.stringify(workflow)).digest("hex");
    const workflowId = this.store.upsertWorkflow(workflow.name, "embedded", yamlHash);
    const runId = this.store.createRun(workflowId, args);
    this.store.updateRunStatus(runId, "running");

    // 2. Build DAG layers
    const layers = buildDag(workflow.nodes);
    const nodeMap = new Map<string, Node>();
    for (const node of workflow.nodes) {
      nodeMap.set(node.id, node);
    }

    // Accumulate outputs across layers
    const nodeOutputs: Record<string, { output: string }> = {};
    const builtins: Record<string, string> = {};
    if (args) builtins.ARGUMENTS = args;

    let finalStatus: RunResult["status"] = "completed";

    try {
      // 3. Execute layer by layer
      for (const layer of layers) {
        const layerPromises = layer.nodeIds.map((nodeId) =>
          this.executeNode(
            nodeId,
            nodeMap.get(nodeId)!,
            workflow,
            runId,
            cwd,
            nodeOutputs,
            builtins,
          ),
        );

        const results = await Promise.allSettled(layerPromises);

        // Check for failures
        for (const result of results) {
          if (result.status === "rejected") {
            if (result.reason instanceof WorkflowCancelledError) {
              finalStatus = "cancelled";
            } else {
              finalStatus = "failed";
            }
          }
        }

        if (finalStatus !== "completed") break;
      }
    } catch (error) {
      if (error instanceof WorkflowCancelledError) {
        finalStatus = "cancelled";
      } else {
        finalStatus = "failed";
      }
    }

    // 4. Finalize
    this.store.updateRunStatus(runId, finalStatus);
    const durationMs = Date.now() - startTime;
    this.eventBus.emit("run:done", {
      runId,
      status: finalStatus as "completed" | "failed" | "cancelled",
      durationMs,
    });

    return { runId, status: finalStatus };
  }

  private async executeNode(
    nodeId: string,
    node: Node,
    workflow: Workflow,
    runId: string,
    cwd: string,
    nodeOutputs: Record<string, { output: string }>,
    builtins: Record<string, string>,
  ): Promise<void> {
    // Evaluate `when` condition
    if (node.when) {
      const shouldRun = evaluateWhen(node.when, nodeOutputs);
      if (!shouldRun) {
        const execId = this.store.createNodeExecution(runId, nodeId, 1);
        this.store.updateNodeExecutionStatus(execId, "skipped");
        this.eventBus.emit("node:skipped", {
          runId,
          nodeId,
          reason: `when condition false: ${node.when}`,
        });
        return;
      }
    }

    const startTime = Date.now();
    const execId = this.store.createNodeExecution(runId, nodeId, 1);
    this.store.updateNodeExecutionStatus(execId, "running");
    this.eventBus.emit("node:start", { runId, nodeId, attempt: 1 });

    try {
      let output = "";

      if (node.bash !== undefined) {
        const command = substituteVariables(node.bash, builtins, nodeOutputs);
        const result = await runShell(command, cwd);
        output = result.output;
        if (result.exitCode !== 0) {
          throw new Error(`Shell command failed with exit code ${result.exitCode}: ${output}`);
        }
      } else if (node.prompt !== undefined) {
        const prompt = substituteVariables(node.prompt, builtins, nodeOutputs);
        const result = await runAi(prompt, node, workflow, cwd);
        output = result.output;
      } else if (node.loop !== undefined) {
        const result = await runLoop(node, workflow, cwd, runAi);
        output = result.output;
      } else if (node.approval !== undefined) {
        const result = await requestApproval(runId, nodeId, node.approval, this.eventBus);
        output = result.approved ? "approved" : "rejected";
        if (result.response) output += `: ${result.response}`;
      } else if (node.cancel !== undefined) {
        const reason = substituteVariables(node.cancel, builtins, nodeOutputs);
        runCancel(reason);
      }

      const durationMs = Date.now() - startTime;
      this.store.updateNodeExecutionStatus(execId, "completed", durationMs);
      this.store.saveOutput(execId, output);
      this.store.recordEvent(runId, nodeId, "node:complete");
      this.eventBus.emit("node:complete", { runId, nodeId, output, durationMs });

      // Store output for downstream variable substitution
      nodeOutputs[nodeId] = { output };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.store.updateNodeExecutionStatus(execId, "failed", durationMs);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.store.recordEvent(runId, nodeId, "node:error", errorMessage);
      this.eventBus.emit("node:error", { runId, nodeId, error: errorMessage, attempt: 1 });
      throw error;
    }
  }
}
