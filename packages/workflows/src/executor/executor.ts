/** Core workflow executor — orchestrates DAG traversal, node dispatch, and run lifecycle. */

import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";

import { buildDag } from "../dag/build-dag.ts";
import { WorkflowPausedError } from "../runners/approval-runner.ts";
import { WorkflowCancelledError } from "../runners/cancel-runner.ts";
import { classifyError, isRetryable } from "../runners/error-classifier.ts";
import { validateNodeOutput } from "./validate-output.ts";
import { evaluateCondition, checkTriggerRule } from "./condition-evaluator.ts";
import { dispatchNode } from "./node-dispatcher.ts";
import {
  setupIsolation,
  cleanupIsolation,
  type IsolationEnvironment,
} from "../isolation/isolation.ts";

import {
  logWorkflowStart,
  logWorkflowComplete,
  logWorkflowError,
  logNodeStart,
  logNodeComplete,
  logNodeSkip,
  logNodeError,
} from "../logger.ts";

import { buildSessionContext, formatSessionContext } from "../store/session-context.ts";

import type { StoreQueries } from "../store/queries.ts";
import type { WorkflowEventBus } from "../events/event-bus.ts";
import type { Workflow } from "../schema/workflow.ts";
import type { RunStatus } from "../constants.ts";
import type { Node } from "../schema/node.ts";
import type { WorkflowConfig } from "../deps.ts";
import { WORKFLOW_DEFAULTS } from "../deps.ts";

export interface RunResult {
  runId: string;
  status: RunStatus;
}

export class WorkflowExecutor {
  /** Session ID from the last executed node — used for session threading in sequential layers. */
  private lastNodeSessionId: string | undefined;

  constructor(
    private store: StoreQueries,
    private eventBus: WorkflowEventBus,
  ) {}

  async run(
    workflow: Workflow,
    cwd: string,
    args?: string,
    config?: WorkflowConfig,
    sessionId?: string,
  ): Promise<RunResult> {
    // Phase 1: Persist workflow and create run record
    const yamlHash = createHash("sha256").update(JSON.stringify(workflow)).digest("hex");
    const workflowId = this.store.upsertWorkflow(workflow.name, "embedded", yamlHash);

    // Create run — associated with session if provided
    const runId = sessionId
      ? this.store.createRunInSession(workflowId, sessionId, args)
      : this.store.createRun(workflowId, args);
    this.store.updateRunStatus(runId, "running");

    return this.executeFromLayers(
      workflow,
      runId,
      cwd,
      args,
      {}, // No prior node outputs
      new Set(), // No completed nodes
      config ?? WORKFLOW_DEFAULTS,
      sessionId,
    );
  }

  /**
   * Resume a paused or failed run from the last checkpoint.
   * Completed nodes are skipped — execution continues from the first incomplete layer.
   */
  async resume(
    workflow: Workflow,
    runId: string,
    cwd: string,
    args?: string,
    config?: WorkflowConfig,
    sessionId?: string,
  ): Promise<RunResult> {
    // Load already-completed node outputs
    const completedNodeIds = this.store.getCompletedNodeIds(runId);
    const nodeOutputs = this.store.getNodeOutputs(runId);

    this.store.updateRunStatus(runId, "running");

    // Re-run with prior state
    return this.executeFromLayers(
      workflow,
      runId,
      cwd,
      args,
      nodeOutputs,
      completedNodeIds,
      config ?? WORKFLOW_DEFAULTS,
      sessionId,
    );
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
    config: WorkflowConfig,
    sessionId?: string,
  ): Promise<RunResult> {
    const startTime = Date.now();
    logWorkflowStart(runId, workflow.name);

    // Activity heartbeat tracking
    let lastHeartbeat = Date.now();
    const HEARTBEAT_INTERVAL = 60_000; // 60 seconds
    const layers = buildDag(workflow.nodes);
    const nodeMap = new Map<string, Node>();
    for (const node of workflow.nodes) {
      nodeMap.set(node.id, node);
    }

    // Setup isolation environment if configured
    let isolationEnv: IsolationEnvironment | undefined;
    let effectiveCwd = cwd;

    if (workflow.isolation) {
      isolationEnv = await setupIsolation(workflow.isolation, runId, cwd);
      effectiveCwd = isolationEnv.workingDirectory;
    }

    // Use effectiveCwd instead of cwd for artifacts and node execution
    const artifactsDir = `${effectiveCwd}/.cc-framework/artifacts/${runId}`;
    await mkdir(artifactsDir, { recursive: true });

    const promptDir = config.paths.projectPrompts || `${effectiveCwd}/.cc-framework/prompts`;
    const builtins: Record<string, string> = {
      ARTIFACTS_DIR: artifactsDir,
      DOCS_DIR: config.paths.docsDir || `${effectiveCwd}/docs`,
      PROMPT_DIR: promptDir,
      WORKFLOW_ID: runId,
      REJECTION_REASON: "",
      LOOP_USER_INPUT: "",
    };
    if (args) builtins.ARGUMENTS = args;

    // Inject cross-workflow session context if running within a session
    if (sessionId) {
      const ctx = buildSessionContext(sessionId, this.store);
      const formatted = formatSessionContext(ctx);
      if (formatted) {
        builtins.SESSION_CONTEXT = formatted;
      }
    }

    // Track node terminal statuses for trigger rule evaluation
    // Pre-populate from completed nodes (important for resume scenarios)
    const nodeStatuses: Record<string, { completed: boolean; failed: boolean; skipped: boolean }> =
      {};
    for (const id of completedNodeIds) {
      nodeStatuses[id] = { completed: true, failed: false, skipped: false };
    }

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
            effectiveCwd,
            nodeOutputs,
            nodeStatuses,
            builtins,
            config,
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

        // Activity heartbeat (throttled)
        if (Date.now() - lastHeartbeat > HEARTBEAT_INTERVAL) {
          this.store.updateRunActivity(runId);
          lastHeartbeat = Date.now();
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
    } finally {
      // Cleanup isolation environment
      if (isolationEnv) {
        await cleanupIsolation(isolationEnv).catch(() => {});
      }
    }

    // Finalize run status and emit completion event
    this.store.updateRunStatus(runId, finalStatus);
    const durationMs = Date.now() - startTime;
    if (finalStatus !== "paused") {
      this.eventBus.emit("run:done", { runId, status: finalStatus, durationMs });
    }

    // Structured logging
    if (finalStatus === "completed") {
      logWorkflowComplete(runId, durationMs);
    } else if (finalStatus === "failed") {
      logWorkflowError(runId, "Workflow execution failed");
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
    nodeStatuses: Record<string, { completed: boolean; failed: boolean; skipped: boolean }>,
    builtins: Record<string, string>,
    config: WorkflowConfig,
    resumeSessionId?: string,
  ): Promise<void> {
    // Check trigger rule against dependency statuses
    if (node.depends_on.length > 0) {
      const depStatuses = node.depends_on.map(
        (depId) => nodeStatuses[depId] ?? { completed: false, failed: false, skipped: false },
      );
      if (!checkTriggerRule(node.trigger_rule, depStatuses)) {
        const execId = this.store.createNodeExecution(runId, nodeId, 1);
        this.store.updateNodeExecutionStatus(execId, "skipped");
        this.eventBus.emit("node:skipped", {
          runId,
          nodeId,
          reason: `trigger_rule "${node.trigger_rule}" not satisfied`,
        });
        logNodeSkip(runId, nodeId, `trigger_rule "${node.trigger_rule}" not satisfied`);
        nodeStatuses[nodeId] = { completed: false, failed: false, skipped: true };
        return;
      }
    }

    // Evaluate `when` condition — skip node if it returns false
    if (node.when) {
      const shouldRun = evaluateCondition(node.when, nodeOutputs);
      if (!shouldRun) {
        const execId = this.store.createNodeExecution(runId, nodeId, 1);
        this.store.updateNodeExecutionStatus(execId, "skipped");
        this.eventBus.emit("node:skipped", {
          runId,
          nodeId,
          reason: `when condition false: ${node.when}`,
        });
        logNodeSkip(runId, nodeId, `when condition false: ${node.when}`);
        nodeStatuses[nodeId] = { completed: false, failed: false, skipped: true };
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
      logNodeStart(runId, nodeId, attempt);

      try {
        const result = await dispatchNode(node, {
          workflow,
          config,
          runId,
          nodeId,
          cwd,
          builtins,
          nodeOutputs,
          resumeSessionId,
          eventBus: this.eventBus,
        });

        const output = result.output;

        // Store session ID for threading
        if (result.sessionId) {
          this.lastNodeSessionId = result.sessionId;
        }

        // Store generated code for audit
        if (result.generatedCode) {
          this.store.recordEvent(runId, nodeId, "node:code_generated", result.generatedCode);
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
        logNodeComplete(runId, nodeId, durationMs);
        nodeOutputs[nodeId] = { output };
        nodeStatuses[nodeId] = { completed: true, failed: false, skipped: false };
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
        logNodeError(runId, nodeId, errorMessage, attempt);
        nodeStatuses[nodeId] = { completed: false, failed: true, skipped: false };
        throw error;
      }
    }
  }
}
