/** Dispatches a node to the appropriate runner based on its type. */

import { substituteVariables } from "../variables/substitute.ts";
import { runScript } from "../runners/script-runner.ts";
import { runAi, type AiResult } from "../runners/ai-runner.ts";
import { runCodeMode } from "../runners/code-mode-runner.ts";
import { runLoop } from "../runners/loop-runner.ts";
import { requestApproval } from "../runners/approval-runner.ts";
import { runCancel } from "../runners/cancel-runner.ts";
import { resolveModel } from "./resolve-model.ts";

import type { Node } from "../schema/node.ts";
import type { Workflow } from "../schema/workflow.ts";
import type { WorkflowEventBus } from "../events/event-bus.ts";
import type { ResolvedConfig } from "../config/types.ts";
import {
  isPromptNode,
  isScriptNode,
  isLoopNode,
  isApprovalNode,
  isCancelNode,
} from "../schema/node.ts";

// ---- Types ----

export interface DispatchResult {
  /** The text output produced by the node. */
  output: string;
  /** Session ID from AI nodes (for session threading). */
  sessionId?: string;
  /** Generated code from Code Mode execution (for audit). */
  generatedCode?: string;
}

export interface DispatchContext {
  workflow: Workflow;
  config: ResolvedConfig;
  runId: string;
  nodeId: string;
  cwd: string;
  builtins: Record<string, string>;
  nodeOutputs: Record<string, { output: string }>;
  resumeSessionId?: string;
  eventBus: WorkflowEventBus;
}

// ---- Main ----

/**
 * Dispatch a node to the appropriate runner and return its output.
 *
 * This is the pure dispatch logic — no lifecycle management (execution records,
 * retry, events). The executor handles those concerns.
 */
export async function dispatchNode(node: Node, ctx: DispatchContext): Promise<DispatchResult> {
  if (isScriptNode(node)) {
    const command = substituteVariables(node.script, ctx.builtins, ctx.nodeOutputs);
    const result = await runScript(
      command,
      ctx.cwd,
      node.runtime ?? "bash",
      node.deps,
      node.timeout,
      ctx.builtins,
    );
    if (result.exitCode !== 0) {
      throw new Error(`Script failed with exit code ${result.exitCode}: ${result.output}`);
    }
    return { output: result.output };
  }

  if (isPromptNode(node)) {
    const prompt = substituteVariables(node.prompt, ctx.builtins, ctx.nodeOutputs);

    if (node.execution === "code") {
      const result = await runCodeMode(prompt, node, ctx.workflow, ctx.cwd, ctx.builtins);
      if (result.error) {
        throw new Error(result.error);
      }
      return { output: result.output, generatedCode: result.generatedCode };
    }

    // Agent Mode (default)
    const result = await runAi(prompt, node, ctx.workflow, ctx.cwd, ctx.resumeSessionId);
    if (result.error) {
      throw new Error(`AI node error (partial output preserved): ${result.error}`);
    }
    return { output: result.output, sessionId: result.sessionId };
  }

  if (isLoopNode(node)) {
    const result = await runLoop(node, ctx.workflow, ctx.cwd, runAi);
    return { output: result.output };
  }

  if (isApprovalNode(node)) {
    // requestApproval throws WorkflowPausedError — never returns
    requestApproval(ctx.runId, ctx.nodeId, node.approval, ctx.eventBus);
    // unreachable, but TypeScript needs a return
    return { output: "" };
  }

  if (isCancelNode(node)) {
    const reason = substituteVariables(node.cancel, ctx.builtins, ctx.nodeOutputs);
    runCancel(reason);
    // unreachable
    return { output: "" };
  }

  throw new Error(`Unknown node type for node "${ctx.nodeId}"`);
}
