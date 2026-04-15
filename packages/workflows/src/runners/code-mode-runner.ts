/** Code Mode runner — LLM generates executable code instead of using tool calls.
 *
 * Inspired by Cloudflare Code Mode and Anthropic PTC. Instead of N sequential
 * tool calls (each a round-trip), the LLM writes a complete program that handles
 * iteration internally. This improves both reliability (fewer steps to fail)
 * and token efficiency (no repeated context per tool call).
 */

import type { Node } from "../schema/node.ts";
import type { Workflow } from "../schema/workflow.ts";
import { SCRIPT_RUNTIMES } from "../constants.ts";
import type { ScriptRuntime } from "../constants.ts";
import { runScript, type ScriptResult } from "./script-runner.ts";

// ---- Types ----

/** Result from a Code Mode execution, including generated code for audit. */
export interface CodeModeResult {
  /** The stdout output from executing the generated code. */
  output: string;
  /** The generated code (for debugging/audit). */
  generatedCode: string;
  /** Exit code from the script execution. */
  exitCode: number;
  /** If the LLM failed to generate code or the code failed to execute. */
  error?: string;
}

// ---- Helpers ----

/**
 * Build the system prompt that instructs the LLM to generate code.
 * Describes the runtime, available environment, and output expectations.
 */
export function buildCodeModeSystemPrompt(
  runtime: ScriptRuntime,
  builtins: Record<string, string>,
): string {
  const runtimeDesc: Record<ScriptRuntime, string> = {
    bash: "Bash shell script. You have access to all standard Unix tools, git, curl, jq, etc.",
    bun: "TypeScript executed via Bun. You have access to Node.js built-ins (fs, path, child_process, fetch). No npm imports unless they are pre-installed.",
    uv: "Python executed via uv. You have access to the Python standard library. Additional packages can be requested via inline deps.",
  };

  const envVars = Object.entries(builtins)
    .map(([key, value]) => `  ${key}="${value}"`)
    .join("\n");

  return `You are a code generator. Your job is to write a complete, executable ${runtime} script.

RUNTIME: ${runtimeDesc[runtime]}

ENVIRONMENT VARIABLES AVAILABLE:
${envVars}

RULES:
1. Output ONLY the executable code — no explanations, no markdown fences, no comments about what the code does.
2. The script must print its final result to stdout.
3. Handle errors gracefully within the code (try/catch, error checking).
4. Use the environment variables provided (access via process.env in JS/TS, os.environ in Python, $VAR in bash).
5. If the task involves multiple operations, use loops — do NOT ask for tool calls.
6. The code will be executed as-is. It must be syntactically correct and complete.`;
}

/**
 * Extract executable code from LLM output.
 * Strips markdown code fences (```typescript ... ```) if present.
 */
export function extractCode(output: string): string {
  // Try to extract from markdown fences with language tag
  const fenceMatch = output.match(/```(?:typescript|javascript|python|bash|sh)?\n([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // Try triple-backtick without language
  const plainFenceMatch = output.match(/```\n([\s\S]*?)```/);
  if (plainFenceMatch) {
    return plainFenceMatch[1].trim();
  }

  // No fences — use the output as-is (model followed instructions)
  return output.trim();
}

// ---- Main ----

/**
 * Execute a prompt node in Code Mode.
 *
 * Flow:
 * 1. Build a system prompt describing the runtime and available environment
 * 2. Call the LLM asking it to generate a complete script (no tools allowed)
 * 3. Extract the code from the response
 * 4. Execute via runScript()
 * 5. Return the execution result + generated code for audit
 */
export async function runCodeMode(
  prompt: string,
  node: Node,
  workflow: Workflow,
  cwd: string,
  builtins: Record<string, string>,
): Promise<CodeModeResult> {
  const runtimeSet: ReadonlySet<string> = new Set(SCRIPT_RUNTIMES);
  const raw = node.runtime ?? "bun";
  const runtime: ScriptRuntime = runtimeSet.has(raw) ? (raw as ScriptRuntime) : "bun";

  // Phase 1: Ask the LLM to generate code
  // We use the Agent SDK but with NO tools — forcing pure text output
  // @ts-ignore -- optional peer dependency
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  let llmOutput = "";
  const systemPrompt = buildCodeModeSystemPrompt(runtime, builtins);

  try {
    // SDK boundary: query() returns an async iterable but SDK types don't expose it.
    const events = query({
      prompt: `${systemPrompt}\n\nTASK:\n${prompt}`,
      options: {
        allowedTools: [], // No tools — force code generation
        model: node.model ?? workflow.model,
        cwd,
      },
    }) as AsyncIterable<{ type: string; [key: string]: unknown }>;

    for await (const message of events) {
      if ("result" in message && typeof message.result === "string") {
        llmOutput = message.result;
      }
    }
  } catch (err) {
    const { toError } = await import("@cc-framework/utils");
    const errorMessage = toError(err).message;
    return {
      output: "",
      generatedCode: "",
      exitCode: 1,
      error: `Code generation failed: ${errorMessage}`,
    };
  }

  if (!llmOutput) {
    return {
      output: "",
      generatedCode: "",
      exitCode: 1,
      error: "LLM returned empty response — no code generated",
    };
  }

  // Phase 2: Extract and execute the generated code
  const generatedCode = extractCode(llmOutput);

  const scriptResult: ScriptResult = await runScript(
    generatedCode,
    cwd,
    runtime,
    node.deps,
    node.timeout,
  );

  return {
    output: scriptResult.output,
    generatedCode,
    exitCode: scriptResult.exitCode,
    error:
      scriptResult.exitCode !== 0
        ? `Generated code failed with exit code ${scriptResult.exitCode}`
        : undefined,
  };
}
