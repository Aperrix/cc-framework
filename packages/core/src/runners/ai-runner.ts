/** Runs an AI prompt node via the Claude Agent SDK, streaming messages to extract the result. */

import type { Node } from "../schema/node.ts";
import type { Workflow } from "../schema/workflow.ts";

/** Result from an AI node execution, optionally carrying a session ID for context reuse. */
export interface AiResult {
  output: string;
  sessionId?: string;
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

/** Send a prompt to the Claude Agent SDK and collect the final result text. */
export async function runAi(
  prompt: string,
  node: Node,
  workflow: Workflow,
  cwd: string,
  resumeSessionId?: string,
): Promise<AiResult> {
  // @ts-ignore -- optional peer dependency, resolved at runtime
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

  // Stream SDK messages; capture session_id from the init message and the
  // final result text from the result message.
  for await (const message of query({ prompt, options }) as AsyncIterable<SdkMessage>) {
    if (message.type === "system" && "subtype" in message && message.subtype === "init") {
      sessionId = (message as SdkInitMessage).session_id;
    }
    if ("result" in message && typeof message.result === "string") {
      output = message.result;
    }
  }

  return { output, sessionId };
}
