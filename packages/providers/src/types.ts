/** Core provider interfaces for multi-provider AI agent support. */

/** Capabilities advertised by a provider. */
export interface ProviderCapabilities {
  /** Whether the provider supports MCP (Model Context Protocol) tool servers. */
  supportsMcp: boolean;
  /** Whether the provider supports tool/function calling. */
  supportsTools: boolean;
  /** Whether the provider supports extended thinking / chain-of-thought. */
  supportsThinking: boolean;
  /** Maximum context window size in tokens. */
  maxContextTokens: number;
}

/** Options passed to a provider's query method. */
export interface QueryOptions {
  /** The prompt to send to the model. */
  prompt: string;
  /** Model identifier override (provider-specific). */
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
