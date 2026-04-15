import { describe, expect, it, beforeEach } from "vite-plus/test";
import {
  registerProvider,
  unregisterProvider,
  getRegisteredProviders,
  getRegistration,
  isRegisteredProvider,
  inferProviderFromModel,
  isModelCompatible,
  clearRegistry,
} from "../src/registry.ts";
import { CODEX_CAPABILITIES } from "../src/capabilities.ts";
import type {
  IAgentProvider,
  QueryOptions,
  QueryResult,
  ProviderCapabilities,
  ProviderRegistration,
} from "../src/types.ts";

// ---- Test Helpers ----

function makeProvider(id: string, patterns: RegExp[]): ProviderRegistration {
  const isCompat = (model: string) => patterns.some((p) => p.test(model.toLowerCase()));
  return {
    id,
    displayName: `Test ${id}`,
    builtIn: false,
    capabilities: CODEX_CAPABILITIES,
    isModelCompatible: isCompat,
    factory: () =>
      ({
        id,
        query: async (_opts: QueryOptions): Promise<QueryResult> => ({
          output: "test",
          durationMs: 0,
        }),
        isModelCompatible: isCompat,
        getCapabilities: (): ProviderCapabilities => CODEX_CAPABILITIES,
      }) satisfies IAgentProvider,
  };
}

// ---- Tests ----

describe("Provider Registry", () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe("registerProvider / unregisterProvider", () => {
    it("registers and retrieves a provider", () => {
      const reg = makeProvider("test-provider", [/^test-/]);
      registerProvider(reg);

      expect(isRegisteredProvider("test-provider")).toBe(true);
      expect(getRegistration("test-provider")).toBe(reg);
    });

    it("throws on duplicate registration", () => {
      const reg1 = makeProvider("dup", [/^v1-/]);
      const reg2 = makeProvider("dup", [/^v2-/]);
      registerProvider(reg1);
      expect(() => registerProvider(reg2)).toThrow(/already registered/);
    });

    it("unregisters a provider", () => {
      registerProvider(makeProvider("temp", [/^temp-/]));
      expect(unregisterProvider("temp")).toBe(true);
      expect(isRegisteredProvider("temp")).toBe(false);
    });

    it("returns false when unregistering a non-existent provider", () => {
      expect(unregisterProvider("ghost")).toBe(false);
    });
  });

  describe("getRegistration", () => {
    it("throws for unregistered provider", () => {
      expect(() => getRegistration("missing")).toThrow(/Unknown provider/);
    });
  });

  describe("getRegisteredProviders", () => {
    it("returns all registered providers", () => {
      registerProvider(makeProvider("a", [/^a-/]));
      registerProvider(makeProvider("b", [/^b-/]));
      const all = getRegisteredProviders();
      expect(all).toHaveLength(2);
      expect(all.map((p) => p.id).sort()).toEqual(["a", "b"]);
    });

    it("returns empty array when no providers registered", () => {
      expect(getRegisteredProviders()).toEqual([]);
    });
  });

  describe("inferProviderFromModel", () => {
    beforeEach(() => {
      registerProvider(makeProvider("claude", [/^claude-/, /^sonnet$/, /^opus$/, /^haiku$/]));
      registerProvider(makeProvider("codex", [/^codex-/, /^gpt-/, /^o1-/, /^o3-/]));
    });

    it("infers claude for claude-* models", () => {
      expect(inferProviderFromModel("claude-sonnet-4-20250514", "codex")).toBe("claude");
    });

    it("infers claude for shorthand model names", () => {
      expect(inferProviderFromModel("sonnet", "codex")).toBe("claude");
      expect(inferProviderFromModel("opus", "codex")).toBe("claude");
      expect(inferProviderFromModel("haiku", "codex")).toBe("claude");
    });

    it("infers codex for gpt-* models", () => {
      expect(inferProviderFromModel("gpt-4o", "claude")).toBe("codex");
    });

    it("infers codex for o1/o3 models", () => {
      expect(inferProviderFromModel("o1-preview", "claude")).toBe("codex");
      expect(inferProviderFromModel("o3-mini", "claude")).toBe("codex");
    });

    it("falls back to default for unknown models", () => {
      expect(inferProviderFromModel("llama-3.1-70b", "claude")).toBe("claude");
    });
  });

  describe("isModelCompatible", () => {
    beforeEach(() => {
      registerProvider(makeProvider("claude", [/^claude-/]));
    });

    it("returns true when model matches provider", () => {
      expect(isModelCompatible("claude", "claude-sonnet-4-20250514")).toBe(true);
    });

    it("returns false when model does not match provider", () => {
      expect(isModelCompatible("claude", "gpt-4o")).toBe(false);
    });

    it("returns true when no model is specified", () => {
      expect(isModelCompatible("claude")).toBe(true);
    });

    it("returns false for unregistered provider", () => {
      expect(isModelCompatible("unknown", "anything")).toBe(false);
    });
  });
});
