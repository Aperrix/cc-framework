import type { Node } from "../schema/node.ts";
import type { Workflow } from "../schema/workflow.ts";

export interface AiResult {
  output: string;
  sessionId?: string;
}

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
  // denied_tools mapped to SDK option if supported
  if (node.denied_tools) {
    options.deniedTools = node.denied_tools;
  }

  for await (const message of query({ prompt, options })) {
    if ("type" in message && message.type === "system" && (message as any).subtype === "init") {
      sessionId = (message as any).session_id;
    }
    if ("result" in message) {
      output = (message as any).result;
    }
  }

  return { output, sessionId };
}
