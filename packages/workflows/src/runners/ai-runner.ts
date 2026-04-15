/** Runs an AI prompt node via the Claude Agent SDK, streaming messages to extract the result. */

import type { Node } from "../schema/node.ts";
import type { Workflow } from "../schema/workflow.ts";
import { expandModelAlias } from "../executor/resolve-model.ts";
import { toError } from "@cc-framework/utils";

/** Result from an AI node execution, optionally carrying a session ID for context reuse. */
export interface AiResult {
  /** The final output text from the AI, or partial output if an error occurred. */
  output: string;
  /** Session ID for context reuse across sequential nodes. */
  sessionId?: string;
  /** If set, the AI execution encountered an error but may have partial output. */
  error?: string;
}

// ---- SDK Message Shapes ----

interface SdkInitMessage {
  type: "system";
  subtype: "init";
  session_id: string;
}

interface SdkResultMessage {
  type: "result";
  result: string;
}

type SdkMessage = SdkInitMessage | SdkResultMessage | { type: string; [key: string]: unknown };

// ---- Options Builder ----

/** Build SDK options from node and workflow configuration. */
function buildSdkOptions(
  node: Node,
  workflow: Workflow,
  cwd: string,
  resumeSessionId?: string,
): Record<string, unknown> {
  const model = expandModelAlias(node.model ?? workflow.model ?? "sonnet");

  const options: Record<string, unknown> = {
    model,
    cwd,
    permissionMode: "bypassPermissions",
  };

  // Tool restrictions
  if (node.allowed_tools) options.allowedTools = node.allowed_tools;
  if (node.denied_tools) options.deniedTools = node.denied_tools;

  // System prompt (node-level or workflow-level)
  if (node.systemPrompt) options.systemPrompt = node.systemPrompt;

  // Session resume
  if (resumeSessionId) options.resume = resumeSessionId;

  // Effort / thinking (Claude SDK options)
  const effort = node.effort ?? workflow.effort;
  if (effort) options.effort = effort;

  const thinking = node.thinking ?? workflow.thinking;
  if (
    thinking &&
    typeof thinking === "object" &&
    "budgetTokens" in thinking &&
    thinking.budgetTokens
  ) {
    options.maxThinkingTokens = thinking.budgetTokens;
  }

  // Budget limit
  if (node.maxBudgetUsd) options.maxBudgetUsd = node.maxBudgetUsd;

  // Fallback model
  const fallback = node.fallbackModel ?? workflow.fallbackModel;
  if (fallback) options.fallbackModel = expandModelAlias(fallback);

  // Betas
  const betas = node.betas ?? workflow.betas;
  if (betas) options.betas = betas;

  // Sandbox
  if (node.sandbox) options.sandbox = node.sandbox;

  return options;
}

// ---- Main ----

/**
 * Send a prompt to the Claude Agent SDK and collect the result.
 *
 * Error resilience: if the SDK throws mid-stream (rate limit, network error),
 * any partial output already collected is preserved in the result alongside
 * the error. The caller (executor) decides whether to use, retry, or fail.
 */
export async function runAi(
  prompt: string,
  node: Node,
  workflow: Workflow,
  cwd: string,
  resumeSessionId?: string,
): Promise<AiResult> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  let output = "";
  let sessionId: string | undefined;

  const options = buildSdkOptions(node, workflow, cwd, resumeSessionId);

  try {
    // SDK boundary: query() returns an async iterable but the SDK types don't
    // expose AsyncIterable directly. The runtime contract is stable.
    const events = query({ prompt, options }) as AsyncIterable<SdkMessage>;

    for await (const message of events) {
      if (
        message.type === "system" &&
        "subtype" in message &&
        message.subtype === "init" &&
        "session_id" in message
      ) {
        sessionId = String(message.session_id);
      }
      if ("result" in message && typeof message.result === "string") {
        output = message.result;
      }
    }

    return { output, sessionId };
  } catch (err) {
    return {
      output,
      sessionId,
      error: toError(err).message,
    };
  }
}
