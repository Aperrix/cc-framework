/** Core workflow executor — orchestrates DAG traversal, node dispatch, and run lifecycle. */

import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";

import { buildDag } from "../dag/build-dag.ts";
import { substituteVariables } from "../variables/substitute.ts";
import { runScript } from "../runners/script-runner.ts";
import { runAi } from "../runners/ai-runner.ts";
import { runLoop } from "../runners/loop-runner.ts";
import { requestApproval, WorkflowPausedError } from "../runners/approval-runner.ts";
import { runCancel, WorkflowCancelledError } from "../runners/cancel-runner.ts";

import type { StoreQueries } from "../store/queries.ts";
import type { WorkflowEventBus } from "../events/event-bus.ts";
import type { Workflow } from "../schema/workflow.ts";
import type { RunStatus } from "../constants.ts";
import {
  type Node,
  isPromptNode,
  isScriptNode,
  isLoopNode,
  isApprovalNode,
  isCancelNode,
} from "../schema/node.ts";

export interface RunResult {
  runId: string;
  status: RunStatus;
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
  // Pattern: $nodeId.output[.field] OP 'value'
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

    // Phase 1: Persist workflow and create run record
    const yamlHash = createHash("sha256").update(JSON.stringify(workflow)).digest("hex");
    const workflowId = this.store.upsertWorkflow(workflow.name, "embedded", yamlHash);
    const runId = this.store.createRun(workflowId, args);
    this.store.updateRunStatus(runId, "running");

    // Phase 2: Build DAG layers and prepare execution context
    const layers = buildDag(workflow.nodes);
    const nodeMap = new Map<string, Node>();
    for (const node of workflow.nodes) {
      nodeMap.set(node.id, node);
    }

    const artifactsDir = `${cwd}/.cc-framework/artifacts/${runId}`;
    await mkdir(artifactsDir, { recursive: true });

    const nodeOutputs: Record<string, { output: string }> = {};
    const builtins: Record<string, string> = { ARTIFACTS_DIR: artifactsDir };
    if (args) builtins.ARGUMENTS = args;

    let finalStatus: RunStatus = "completed";

    try {
      // Phase 3: Execute layer by layer (nodes within a layer run in parallel)
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

        for (const result of results) {
          if (result.status === "rejected") {
            if (result.reason instanceof WorkflowCancelledError) {
              finalStatus = "cancelled";
            } else if (result.reason instanceof WorkflowPausedError) {
              finalStatus = "paused";
            } else {
              finalStatus = "failed";
            }
          }
        }

        if (finalStatus !== "completed") break;

        // Check run status between layers (supports external cancellation/pause)
        const currentStatus = this.store.getRunStatus(runId);
        if (currentStatus === "cancelled" || currentStatus === "paused") {
          finalStatus = currentStatus;
          break;
        }
      }
    } catch (error) {
      if (error instanceof WorkflowCancelledError) {
        finalStatus = "cancelled";
      } else {
        finalStatus = "failed";
      }
    }

    // Phase 4: Finalize run status and emit completion event
    this.store.updateRunStatus(runId, finalStatus);
    const durationMs = Date.now() - startTime;
    if (finalStatus !== "paused") {
      this.eventBus.emit("run:done", { runId, status: finalStatus, durationMs });
    }

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
    // Evaluate `when` condition — skip node if it returns false
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

      if (isScriptNode(node)) {
        const command = substituteVariables(node.script, builtins, nodeOutputs);
        const result = await runScript(
          command,
          cwd,
          node.runtime ?? "bash",
          node.deps,
          node.timeout,
        );
        output = result.output;
        if (result.exitCode !== 0) {
          throw new Error(`Script failed with exit code ${result.exitCode}: ${output}`);
        }
      } else if (isPromptNode(node)) {
        const prompt = substituteVariables(node.prompt, builtins, nodeOutputs);
        const result = await runAi(prompt, node, workflow, cwd);
        output = result.output;
      } else if (isLoopNode(node)) {
        const result = await runLoop(node, workflow, cwd, runAi);
        output = result.output;
      } else if (isApprovalNode(node)) {
        requestApproval(runId, nodeId, node.approval, this.eventBus);
      } else if (isCancelNode(node)) {
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
      if (error instanceof WorkflowPausedError) {
        this.store.pauseRun(runId, error.approvalContext);
        throw error;
      }

      const durationMs = Date.now() - startTime;
      this.store.updateNodeExecutionStatus(execId, "failed", durationMs);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.store.recordEvent(runId, nodeId, "node:error", errorMessage);
      this.eventBus.emit("node:error", { runId, nodeId, error: errorMessage, attempt: 1 });
      throw error;
    }
  }
}
