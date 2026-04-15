/** Claude provider — wraps the @anthropic-ai/claude-agent-sdk. */

import type { IAgentProvider, ProviderCapabilities, QueryOptions, QueryResult } from "./types.ts";
import { registerProvider } from "./registry.ts";

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

// ---- Model Matching & Aliases ----

const CLAUDE_MODEL_PATTERNS = [/^claude-/, /^sonnet$/, /^opus$/, /^haiku$/];

const MODEL_ALIASES: Record<string, string> = {
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-6",
  haiku: "claude-haiku-4-5-20251001",
};

function isClaudeModel(model: string): boolean {
  const lower = model.toLowerCase();
  return CLAUDE_MODEL_PATTERNS.some((p) => p.test(lower));
}

function resolveModel(model: string | undefined): string | undefined {
  if (!model) return undefined;
  return MODEL_ALIASES[model.toLowerCase()] ?? model;
}

// ---- Provider Implementation ----

class ClaudeProvider implements IAgentProvider {
  readonly id = "claude";

  async query(options: QueryOptions): Promise<QueryResult> {
    const { query: sdkQuery } = await import("@anthropic-ai/claude-agent-sdk");

    const start = Date.now();
    let output = "";
    let sessionId: string | undefined;

    const sdkOptions: Record<string, unknown> = {
      model: resolveModel(options.model),
      cwd: options.cwd,
      permissionMode: options.permissionMode ?? "bypassPermissions",
    };

    // Optional fields — only set if provided
    if (options.systemPrompt) sdkOptions.systemPrompt = options.systemPrompt;
    if (options.allowedTools) sdkOptions.allowedTools = options.allowedTools;
    if (options.deniedTools) sdkOptions.deniedTools = options.deniedTools;
    if (options.resumeSessionId) sdkOptions.resume = options.resumeSessionId;
    if (options.maxBudgetUsd) sdkOptions.maxBudgetUsd = options.maxBudgetUsd;
    if (options.effort) sdkOptions.effort = options.effort;
    if (options.maxThinkingTokens) sdkOptions.maxThinkingTokens = options.maxThinkingTokens;
    if (options.fallbackModel) sdkOptions.fallbackModel = resolveModel(options.fallbackModel);
    if (options.betas) sdkOptions.betas = options.betas;
    if (options.sandbox) sdkOptions.sandbox = options.sandbox;

    // SDK boundary: sdkQuery returns an async iterable but the SDK types don't
    // expose AsyncIterable directly. The runtime contract is stable.
    const events = sdkQuery({
      prompt: options.prompt,
      options: sdkOptions,
    }) as AsyncIterable<SdkMessage>;

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

    return {
      output,
      sessionId,
      durationMs: Date.now() - start,
    };
  }

  isModelCompatible(model: string): boolean {
    return isClaudeModel(model);
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsMcp: true,
      supportsTools: true,
      supportsThinking: true,
      maxContextTokens: 200_000,
    };
  }
}

// ---- Registration ----

/** Register the Claude provider as a built-in provider. */
export function registerClaudeProvider(): void {
  registerProvider({
    id: "claude",
    builtIn: true,
    isModelCompatible: isClaudeModel,
    factory: () => new ClaudeProvider(),
  });
}

export { ClaudeProvider, isClaudeModel };
