import type { Node } from "../schema/node.ts";
import type { Workflow } from "../schema/workflow.ts";
import type { AiResult } from "./ai-runner.ts";

export interface LoopResult {
  output: string;
  iterations: number;
  maxIterationsReached: boolean;
}

type AiRunnerFn = (
  prompt: string,
  node: Node,
  workflow: Workflow,
  cwd: string,
  resumeSessionId?: string,
) => Promise<AiResult>;

export async function runLoop(
  node: Node,
  workflow: Workflow,
  cwd: string,
  runAiFn: AiRunnerFn,
): Promise<LoopResult> {
  const loop = node.loop!;
  let sessionId: string | undefined;
  let lastOutput = "";

  for (let i = 0; i < loop.max_iterations; i++) {
    const resume = loop.fresh_context ? undefined : sessionId;
    const result = await runAiFn(loop.prompt, node, workflow, cwd, resume);
    lastOutput = result.output;
    sessionId = result.sessionId ?? sessionId;

    if (lastOutput.includes(loop.until)) {
      return { output: lastOutput, iterations: i + 1, maxIterationsReached: false };
    }
  }

  return { output: lastOutput, iterations: loop.max_iterations, maxIterationsReached: true };
}
