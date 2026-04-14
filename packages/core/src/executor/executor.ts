/** Core workflow executor — orchestrates DAG traversal, node dispatch, and run lifecycle. */

import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";

import { buildDag } from "../dag/build-dag.ts";
import { substituteVariables } from "../variables/substitute.ts";
import { runScript } from "../runners/script-runner.ts";
import { runAi } from "../runners/ai-runner.ts";
import { runCodeMode } from "../runners/code-mode-runner.ts";
import { runLoop } from "../runners/loop-runner.ts";
import { requestApproval, WorkflowPausedError } from "../runners/approval-runner.ts";
import { runCancel, WorkflowCancelledError } from "../runners/cancel-runner.ts";
import { classifyError, isRetryable } from "../runners/error-classifier.ts";
import { validateNodeOutput } from "./validate-output.ts";

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
  /** Session ID from the last executed node — used for session threading in sequential layers. */
  private lastNodeSessionId: string | undefined;

  constructor(
    private store: StoreQueries,
    private eventBus: WorkflowEventBus,
  ) {}

  async run(workflow: Workflow, cwd: string, args?: string): Promise<RunResult> {
    // Phase 1: Persist workflow and create run record
    const yamlHash = createHash("sha256").update(JSON.stringify(workflow)).digest("hex");
    const workflowId = this.store.upsertWorkflow(workflow.name, "embedded", yamlHash);
    const runId = this.store.createRun(workflowId, args);
    this.store.updateRunStatus(runId, "running");

    return this.executeFromLayers(
      workflow,
      runId,
      cwd,
      args,
      {}, // No prior node outputs
      new Set(), // No completed nodes
    );
  }

  /**
   * Resume a paused or failed run from the last checkpoint.
   * Completed nodes are skipped — execution continues from the first incomplete layer.
   */
  async resume(workflow: Workflow, runId: string, cwd: string, args?: string): Promise<RunResult> {
    // Load already-completed node outputs
    const completedNodeIds = this.store.getCompletedNodeIds(runId);
    const nodeOutputs = this.store.getNodeOutputs(runId);

    this.store.updateRunStatus(runId, "running");

    // Re-run with prior state
    return this.executeFromLayers(workflow, runId, cwd, args, nodeOutputs, completedNodeIds);
  }

  /**
   * Shared layer-execution engine used by both `run()` and `resume()`.
   * Walks DAG layers in order, skipping already-completed nodes and threading
   * session IDs through sequential (single-node) layers.
   */
  private async executeFromLayers(
    workflow: Workflow,
    runId: string,
    cwd: string,
    args: string | undefined,
    nodeOutputs: Record<string, { output: string }>,
    completedNodeIds: Set<string>,
  ): Promise<RunResult> {
    const startTime = Date.now();
    const layers = buildDag(workflow.nodes);
    const nodeMap = new Map<string, Node>();
    for (const node of workflow.nodes) {
      nodeMap.set(node.id, node);
    }

    const artifactsDir = `${cwd}/.cc-framework/artifacts/${runId}`;
    await mkdir(artifactsDir, { recursive: true });

    const builtins: Record<string, string> = { ARTIFACTS_DIR: artifactsDir };
    if (args) builtins.ARGUMENTS = args;

    // Session threading: track the last session ID for sequential layers
    let lastSessionId: string | undefined;

    let finalStatus: RunStatus = "completed";

    try {
      for (const layer of layers) {
        // Skip layers where all nodes are already completed (checkpoint/resume)
        const pendingNodeIds = layer.nodeIds.filter((id) => !completedNodeIds.has(id));
        if (pendingNodeIds.length === 0) continue;

        // Session threading: parallel layers (2+ nodes) break the session chain
        const isParallelLayer = pendingNodeIds.length > 1;
        if (isParallelLayer) {
          lastSessionId = undefined;
        }

        const layerPromises = pendingNodeIds.map((nodeId) =>
          this.executeNode(
            nodeId,
            nodeMap.get(nodeId)!,
            workflow,
            runId,
            cwd,
            nodeOutputs,
            builtins,
            // Session threading: pass lastSessionId for sequential layers
            isParallelLayer ? undefined : lastSessionId,
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

        // Session threading: capture session ID from sequential single-node layers
        if (!isParallelLayer && pendingNodeIds.length === 1) {
          const nodeId = pendingNodeIds[0];
          const node = nodeMap.get(nodeId)!;
          // Only thread if node context is not "fresh"
          if (node.context !== "fresh") {
            lastSessionId = this.lastNodeSessionId;
          } else {
            lastSessionId = undefined;
          }
        }

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

    // Finalize run status and emit completion event
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
    resumeSessionId?: string,
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

    const retryConfig = node.retry;
    const maxAttempts = retryConfig ? retryConfig.max_attempts + 1 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startTime = Date.now();
      const execId = this.store.createNodeExecution(runId, nodeId, attempt);
      this.store.updateNodeExecutionStatus(execId, "running");
      this.eventBus.emit("node:start", { runId, nodeId, attempt });

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

          if (node.execution === "code") {
            // Code Mode: LLM generates a script, we execute it
            const result = await runCodeMode(prompt, node, workflow, cwd, builtins);
            output = result.output;
            // Store generated code as an event for audit/debugging
            this.store.recordEvent(runId, nodeId, "node:code_generated", result.generatedCode);
            if (result.error) {
              throw new Error(result.error);
            }
          } else {
            // Agent Mode (default): full agent loop with tool calls
            const result = await runAi(prompt, node, workflow, cwd, resumeSessionId);
            output = result.output;
            // Store session ID for threading to the next sequential node
            this.lastNodeSessionId = result.sessionId;
            // If the SDK returned an error, throw it (retry logic will handle it)
            // but the partial output is already captured in `output` for potential use
            if (result.error) {
              throw new Error(`AI node error (partial output preserved): ${result.error}`);
            }
          }
        } else if (isLoopNode(node)) {
          const result = await runLoop(node, workflow, cwd, runAi);
          output = result.output;
        } else if (isApprovalNode(node)) {
          requestApproval(runId, nodeId, node.approval, this.eventBus);
        } else if (isCancelNode(node)) {
          const reason = substituteVariables(node.cancel, builtins, nodeOutputs);
          runCancel(reason);
        }

        // Validate structured output against declared schema
        if (node.output_format && output) {
          const validation = validateNodeOutput(node, output);
          if (!validation.valid) {
            throw new Error(`Output validation failed: ${validation.errors.join("; ")}`);
          }
        }

        // Success — record and return
        const durationMs = Date.now() - startTime;
        this.store.updateNodeExecutionStatus(execId, "completed", durationMs);
        this.store.saveOutput(execId, output);
        this.store.recordEvent(runId, nodeId, "node:complete");
        this.eventBus.emit("node:complete", { runId, nodeId, output, durationMs });
        nodeOutputs[nodeId] = { output };
        return;
      } catch (error) {
        // WorkflowPausedError and WorkflowCancelledError are NOT retryable
        if (error instanceof WorkflowPausedError) {
          this.store.pauseRun(runId, error.approvalContext);
          throw error;
        }
        if (error instanceof WorkflowCancelledError) {
          throw error;
        }

        const durationMs = Date.now() - startTime;
        this.store.updateNodeExecutionStatus(execId, "failed", durationMs);
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Should we retry?
        if (retryConfig && attempt < maxAttempts) {
          const classified = classifyError(error);
          const scope = retryConfig.on_error ?? "transient";

          if (isRetryable(classified, scope)) {
            const delay = (retryConfig.delay_ms ?? 3000) * Math.pow(2, attempt - 1);
            this.store.recordEvent(
              runId,
              nodeId,
              "node:retry",
              JSON.stringify({
                attempt,
                delay,
                severity: classified.severity,
              }),
            );
            this.eventBus.emit("node:error", {
              runId,
              nodeId,
              error: `Retrying (attempt ${attempt}/${maxAttempts}): ${errorMessage}`,
              attempt,
            });
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        }

        // Not retryable or attempts exhausted
        this.store.recordEvent(runId, nodeId, "node:error", errorMessage);
        this.eventBus.emit("node:error", {
          runId,
          nodeId,
          error: errorMessage,
          attempt,
        });
        throw error;
      }
    }
  }
}
