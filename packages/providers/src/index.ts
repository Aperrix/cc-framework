/** @cc-framework/providers — multi-provider AI agent abstraction. */

// ---- Types ----
export type { IAgentProvider, ProviderCapabilities, QueryOptions, QueryResult } from "./types.ts";

// ---- Registry ----
export {
  registerProvider,
  unregisterProvider,
  getRegisteredProviders,
  getRegistration,
  isRegisteredProvider,
  inferProviderFromModel,
  isModelCompatible,
  clearRegistry,
  type ProviderRegistration,
} from "./registry.ts";

// ---- Built-in Providers ----
export { ClaudeProvider, isClaudeModel, registerClaudeProvider } from "./claude-provider.ts";
export { CodexProvider, isCodexModel, registerCodexProvider } from "./codex-provider.ts";

// ---- Convenience: register all built-in providers ----

import { registerClaudeProvider } from "./claude-provider.ts";
import { registerCodexProvider } from "./codex-provider.ts";

/** Register all built-in providers (Claude, Codex). Call once at startup. */
export function registerBuiltInProviders(): void {
  registerClaudeProvider();
  registerCodexProvider();
}
