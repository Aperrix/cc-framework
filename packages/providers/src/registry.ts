/** Provider registry — manages registration and lookup of agent providers. */

import type { IAgentProvider } from "./types.ts";

/** Registration entry for a provider. */
export interface ProviderRegistration {
  /** Unique provider identifier. */
  id: string;
  /** Whether this is a built-in (bundled) provider vs. a user-registered one. */
  builtIn: boolean;
  /** Check if a model string is compatible with this provider. */
  isModelCompatible(model: string): boolean;
  /** Factory function that creates a provider instance. */
  factory(): IAgentProvider;
}

const providers = new Map<string, ProviderRegistration>();

/** Register a provider. Overwrites any existing registration with the same ID. */
export function registerProvider(reg: ProviderRegistration): void {
  providers.set(reg.id, reg);
}

/** Remove a provider registration by ID. Returns true if it existed. */
export function unregisterProvider(id: string): boolean {
  return providers.delete(id);
}

/** Get all registered providers. */
export function getRegisteredProviders(): ProviderRegistration[] {
  return [...providers.values()];
}

/** Get a specific provider registration by ID. Throws if not found. */
export function getRegistration(id: string): ProviderRegistration {
  const reg = providers.get(id);
  if (!reg) {
    throw new Error(
      `Provider "${id}" is not registered. Available: ${[...providers.keys()].join(", ")}`,
    );
  }
  return reg;
}

/** Check if a provider is registered. */
export function isRegisteredProvider(id: string): boolean {
  return providers.has(id);
}

/**
 * Infer the provider ID from a model string.
 *
 * Iterates all registered providers and returns the first whose
 * `isModelCompatible` returns true. Falls back to `defaultProvider`
 * if no match is found.
 */
export function inferProviderFromModel(model: string, defaultProvider: string): string {
  for (const reg of providers.values()) {
    if (reg.isModelCompatible(model)) {
      return reg.id;
    }
  }
  return defaultProvider;
}

/**
 * Check if a model is compatible with a specific provider.
 *
 * If no model is given, returns true (any model is valid when unspecified).
 */
export function isModelCompatible(provider: string, model?: string): boolean {
  if (!model) return true;
  const reg = providers.get(provider);
  if (!reg) return false;
  return reg.isModelCompatible(model);
}

/** Reset the registry (useful for testing). */
export function clearRegistry(): void {
  providers.clear();
}
