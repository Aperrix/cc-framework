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
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore -- optional peer dependency, installed at runtime
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  let output = "";
  let sessionId: string | undefined;

  for await (const message of query({
    prompt,
    options: {
      allowedTools: node.allowed_tools,
      deniedTools: node.denied_tools,
      model: node.model ?? workflow.model,
      systemPrompt: node.systemPrompt,
      cwd,
      resume: resumeSessionId,
    },
  })) {
    if ("type" in message && message.type === "system" && (message as any).subtype === "init") {
      sessionId = (message as any).session_id;
    }
    if ("result" in message) {
      output = (message as any).result;
    }
  }

  return { output, sessionId };
}
