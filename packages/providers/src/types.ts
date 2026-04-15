/**
 * Core provider interfaces — contract layer.
 *
 * HARD RULE: This file must never import SDK packages or other @cc-framework/* packages.
 * It is the dependency-free contract that all consumers import from.
 */

// ---- Capability Flags ----

/**
 * Provider capability flags. The executor uses these to warn when a workflow node
 * specifies features the target provider doesn't support.
 */
export interface ProviderCapabilities {
  /** Resume a previous AI session (session threading). */
  sessionResume: boolean;
  /** MCP server configuration per node. */
  mcp: boolean;
  /** SDK hook callbacks per node. */
  hooks: boolean;
  /** Skill preloading per node. */
  skills: boolean;
  /** Tool allowlist/denylist restrictions. */
  toolRestrictions: boolean;
  /** Structured JSON output format. */
  structuredOutput: boolean;
  /** Cost control (maxBudgetUsd). */
  costControl: boolean;
  /** Effort level control. */
  effortControl: boolean;
  /** Extended thinking / chain-of-thought control. */
  thinkingControl: boolean;
  /** Fallback model when primary is unavailable. */
  fallbackModel: boolean;
  /** Sandbox execution mode. */
  sandbox: boolean;
}

// ---- Query Options ----

/** Options passed to a provider's query method. */
export interface QueryOptions {
  /** The prompt to send to the model. */
  prompt: string;
  /** Model identifier override (provider-specific). Aliases (sonnet, opus) accepted. */
  model?: string;
  /** System prompt to prepend. */
  systemPrompt?: string;
  /** Allowed tool names (allowlist). */
  allowedTools?: string[];
  /** Denied tool names (denylist). */
  deniedTools?: string[];
  /** Maximum spend budget in USD. */
  maxBudgetUsd?: number;
  /** Working directory for tool execution. */
  cwd?: string;
  /** Session ID to resume a previous conversation. */
  resumeSessionId?: string;
  /** Effort level for the query. */
  effort?: string;
  /** Maximum thinking tokens (extended thinking). */
  maxThinkingTokens?: number;
  /** Fallback model if primary is unavailable. */
  fallbackModel?: string;
  /** Beta features to enable. */
  betas?: string[];
  /** Sandbox configuration. */
  sandbox?: Record<string, unknown>;
  /** Permission mode for tool execution. */
  permissionMode?: "default" | "plan" | "bypassPermissions";
}

/** Result returned from a provider query. */
export interface QueryResult {
  /** The model's output text. */
  output: string;
  /** Session ID for context reuse, if supported. */
  sessionId?: string;
  /** Wall-clock duration of the query in milliseconds. */
  durationMs: number;
}

// ---- Registration ----

/**
 * Registration entry for a provider in the registry.
 * Carries metadata, a factory, and model-compatibility logic.
 */
export interface ProviderRegistration {
  /** Unique provider identifier (e.g. "claude", "codex"). */
  id: string;
  /** Human-readable display name. */
  displayName: string;
  /** Instantiate a provider. */
  factory: () => IAgentProvider;
  /** Static capability declaration — used for executor warnings. */
  capabilities: ProviderCapabilities;
  /** Check if a model string is compatible with this provider. */
  isModelCompatible: (model: string) => boolean;
  /** Whether this is a built-in provider. */
  builtIn: boolean;
}

// ---- Provider Interface ----

/** Interface that all agent providers must implement. */
export interface IAgentProvider {
  /** Unique provider identifier (e.g. "claude", "codex"). */
  readonly id: string;
  /** Execute a query against the provider's model. */
  query(options: QueryOptions): Promise<QueryResult>;
  /** Check if a model identifier is compatible with this provider. */
  isModelCompatible(model: string): boolean;
  /** Get the capabilities of this provider. */
  getCapabilities(): ProviderCapabilities;
}
