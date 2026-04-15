/** Claude provider — wraps the @anthropic-ai/claude-agent-sdk. */

import type { IAgentProvider, ProviderCapabilities, QueryOptions, QueryResult } from "./types.ts";
import { CLAUDE_CAPABILITIES } from "./capabilities.ts";

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

// ---- Constants ----

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1000;
const FIRST_EVENT_TIMEOUT_MS = 30_000;

// ---- Provider Implementation ----

class ClaudeProvider implements IAgentProvider {
  readonly id = "claude";

  async query(options: QueryOptions): Promise<QueryResult> {
    const { query: sdkQuery } = await import("@anthropic-ai/claude-agent-sdk");

    const start = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.executeQuery(sdkQuery, options);
        return { ...result, durationMs: Date.now() - start };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry on non-transient errors
        if (!isTransientError(lastError) || attempt >= MAX_RETRIES) {
          throw lastError;
        }

        const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError ?? new Error("Claude query failed after retries");
  }

  private async executeQuery(
    sdkQuery: Function,
    options: QueryOptions,
  ): Promise<{ output: string; sessionId?: string }> {
    let output = "";
    let sessionId: string | undefined;

    const sdkOptions: Record<string, unknown> = {
      model: resolveModel(options.model),
      cwd: options.cwd,
      permissionMode: options.permissionMode ?? "bypassPermissions",
    };

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

    // Apply first-event timeout to detect hangs
    const timeoutId = setTimeout(() => {
      throw new Error(`Claude query timed out after ${FIRST_EVENT_TIMEOUT_MS}ms (no first event)`);
    }, FIRST_EVENT_TIMEOUT_MS);

    let firstEvent = true;

    for await (const message of events) {
      if (firstEvent) {
        clearTimeout(timeoutId);
        firstEvent = false;
      }

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

    if (firstEvent) clearTimeout(timeoutId);

    return { output, sessionId };
  }

  isModelCompatible(model: string): boolean {
    return isClaudeModel(model);
  }

  getCapabilities(): ProviderCapabilities {
    return CLAUDE_CAPABILITIES;
  }
}

// ---- Error Classification ----

function isTransientError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("socket hang up") ||
    msg.includes("503") ||
    msg.includes("429")
  );
}

// ---- Registration ----

import { registerProvider } from "./registry.ts";

/** Register the Claude provider with the registry. */
export function registerClaudeProvider(): void {
  registerProvider({
    id: "claude",
    displayName: "Claude (Anthropic)",
    factory: () => new ClaudeProvider(),
    capabilities: CLAUDE_CAPABILITIES,
    isModelCompatible: isClaudeModel,
    builtIn: true,
  });
}

export { ClaudeProvider, isClaudeModel };
