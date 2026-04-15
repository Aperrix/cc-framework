/**
 * Provider Registry — manages registration and lookup of agent providers.
 *
 * Bootstrap: callers must call registerBuiltInProviders() at process entrypoints
 * (server startup, CLI init) before any provider lookups.
 */

import type { IAgentProvider, ProviderCapabilities, ProviderRegistration } from "./types.ts";
import { UnknownProviderError } from "./errors.ts";

const registry = new Map<string, ProviderRegistration>();

/** Register a provider. Throws on duplicate registration. */
export function registerProvider(entry: ProviderRegistration): void {
  if (registry.has(entry.id)) {
    throw new Error(`Provider '${entry.id}' is already registered`);
  }
  registry.set(entry.id, entry);
}

/** Remove a provider registration by ID. Returns true if it existed. */
export function unregisterProvider(id: string): boolean {
  return registry.delete(id);
}

/** Get an instantiated agent provider by ID. Throws UnknownProviderError if not registered. */
export function getAgentProvider(id: string): IAgentProvider {
  const entry = registry.get(id);
  if (!entry) {
    throw new UnknownProviderError(id, [...registry.keys()]);
  }
  return entry.factory();
}

/** Get the full registration entry for a provider. */
export function getRegistration(id: string): ProviderRegistration {
  const entry = registry.get(id);
  if (!entry) {
    throw new UnknownProviderError(id, [...registry.keys()]);
  }
  return entry;
}

/** Get provider capabilities without instantiating a provider. */
export function getProviderCapabilities(id: string): ProviderCapabilities {
  return getRegistration(id).capabilities;
}

/** Get all registered providers. */
export function getRegisteredProviders(): ProviderRegistration[] {
  return [...registry.values()];
}

/** Check if a provider is registered. */
export function isRegisteredProvider(id: string): boolean {
  return registry.has(id);
}

/**
 * Infer the provider ID from a model string.
 * Returns the first provider whose isModelCompatible returns true.
 */
export function inferProviderFromModel(model: string, defaultProvider = "claude"): string {
  for (const reg of registry.values()) {
    if (reg.isModelCompatible(model)) {
      return reg.id;
    }
  }
  return defaultProvider;
}

/** Check if a model is compatible with a specific provider. */
export function isModelCompatible(provider: string, model?: string): boolean {
  if (!model) return true;
  const reg = registry.get(provider);
  if (!reg) return false;
  return reg.isModelCompatible(model);
}

/** Reset the registry (useful for testing). */
export function clearRegistry(): void {
  registry.clear();
}
