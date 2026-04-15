/** Runs an AI prompt node via the Claude Agent SDK, streaming messages to extract the result. */

import type { Node } from "../schema/node.ts";
import type { Workflow } from "../schema/workflow.ts";

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

// Minimal typing for the SDK message fields we consume.

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

  const options: Record<string, unknown> = {
    allowedTools: node.allowed_tools,
    model: node.model ?? workflow.model,
    systemPrompt: node.systemPrompt,
    cwd,
    resume: resumeSessionId,
  };
  if (node.denied_tools) {
    options.deniedTools = node.denied_tools;
  }

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
    // Preserve partial output on failure — the model may have produced
    // useful work before the error (e.g., edited files, created branches).
    const { toError } = await import("@cc-framework/utils");
    return {
      output,
      sessionId,
      error: toError(err).message,
    };
  }
}
