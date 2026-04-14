/** Iterative loop runner that repeats an AI prompt until a termination condition is met. */

import type { Node } from "../schema/node.ts";
import type { Workflow } from "../schema/workflow.ts";
import type { AiResult } from "./ai-runner.ts";

/** Result from a loop execution, including iteration count and whether the limit was hit. */
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

/**
 * Execute the loop's prompt repeatedly until the output contains the `until`
 * string or `max_iterations` is reached. When `fresh_context` is false,
 * the AI session is resumed across iterations to preserve conversation state.
 */
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
    // Resume the previous session unless fresh_context is enabled
    const resume = loop.fresh_context ? undefined : sessionId;
    const result = await runAiFn(loop.prompt, node, workflow, cwd, resume);
    lastOutput = result.output;
    sessionId = result.sessionId ?? sessionId;

    // If the AI returned an error, stop the loop with what we have
    if (result.error) {
      return { output: lastOutput, iterations: i + 1, maxIterationsReached: false };
    }

    // Check termination condition — the `until` string appearing in the output
    if (lastOutput.includes(loop.until)) {
      return { output: lastOutput, iterations: i + 1, maxIterationsReached: false };
    }
  }

  return { output: lastOutput, iterations: loop.max_iterations, maxIterationsReached: true };
}
