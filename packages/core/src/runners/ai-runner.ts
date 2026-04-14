import type { Node } from "../schema/node.ts";
import type { Workflow } from "../schema/workflow.ts";

export interface AiResult {
  output: string;
  sessionId?: string;
}

// SDK message shapes (minimal typing for the fields we use)
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
