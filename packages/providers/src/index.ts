/** @cc-framework/providers — multi-provider AI agent abstraction. */

// ---- Types (contract layer) ----
export type {
  IAgentProvider,
  ProviderCapabilities,
  QueryOptions,
  QueryResult,
  ProviderRegistration,
} from "./types.ts";

// ---- Capabilities ----
export { CLAUDE_CAPABILITIES, CODEX_CAPABILITIES } from "./capabilities.ts";

// ---- Errors ----
export { UnknownProviderError } from "./errors.ts";

// ---- Registry ----
export {
  registerProvider,
  unregisterProvider,
  getAgentProvider,
  getRegistration,
  getProviderCapabilities,
  getRegisteredProviders,
  isRegisteredProvider,
  inferProviderFromModel,
  isModelCompatible,
  clearRegistry,
} from "./registry.ts";

// ---- Built-in Providers ----
export { ClaudeProvider, isClaudeModel, registerClaudeProvider } from "./claude-provider.ts";
export { CodexProvider, isCodexModel, registerCodexProvider } from "./codex-provider.ts";

// ---- Convenience ----

import { registerClaudeProvider } from "./claude-provider.ts";
import { registerCodexProvider } from "./codex-provider.ts";

/** Register all built-in providers (Claude, Codex). Call once at startup. */
export function registerBuiltInProviders(): void {
  registerClaudeProvider();
  registerCodexProvider();
}
