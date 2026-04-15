/** Codex provider — stub for future OpenAI Codex / GPT integration. */

import type { IAgentProvider, ProviderCapabilities, QueryOptions, QueryResult } from "./types.ts";
import { CODEX_CAPABILITIES } from "./capabilities.ts";
import { registerProvider } from "./registry.ts";

// ---- Model Matching ----

const CODEX_MODEL_PATTERNS = [/^codex-/, /^o1-/, /^o3-/, /^o4-/, /^gpt-/];

function isCodexModel(model: string): boolean {
  const lower = model.toLowerCase();
  return CODEX_MODEL_PATTERNS.some((p) => p.test(lower));
}

// ---- Provider Implementation ----

class CodexProvider implements IAgentProvider {
  readonly id = "codex";

  async query(_options: QueryOptions): Promise<QueryResult> {
    throw new Error(
      "Codex provider not yet implemented. This is a placeholder for future OpenAI integration.",
    );
  }

  isModelCompatible(model: string): boolean {
    return isCodexModel(model);
  }

  getCapabilities(): ProviderCapabilities {
    return CODEX_CAPABILITIES;
  }
}

// ---- Registration ----

/** Register the Codex provider with the registry. */
export function registerCodexProvider(): void {
  registerProvider({
    id: "codex",
    displayName: "Codex (OpenAI)",
    factory: () => new CodexProvider(),
    capabilities: CODEX_CAPABILITIES,
    isModelCompatible: isCodexModel,
    builtIn: true,
  });
}

export { CodexProvider, isCodexModel };
