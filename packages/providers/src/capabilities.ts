/** Static capability declarations for built-in providers. */

import type { ProviderCapabilities } from "./types.ts";

export const CLAUDE_CAPABILITIES: ProviderCapabilities = {
  sessionResume: true,
  mcp: false, // Not yet implemented
  hooks: false, // Not yet implemented
  skills: false, // Not yet implemented
  toolRestrictions: true,
  structuredOutput: true,
  costControl: true,
  effortControl: true,
  thinkingControl: true,
  fallbackModel: true,
  sandbox: true,
};

export const CODEX_CAPABILITIES: ProviderCapabilities = {
  sessionResume: false,
  mcp: false,
  hooks: false,
  skills: false,
  toolRestrictions: true,
  structuredOutput: true,
  costControl: false,
  effortControl: true,
  thinkingControl: false,
  fallbackModel: false,
  sandbox: false,
};
