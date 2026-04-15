/** Tests for CodexProvider and isCodexModel. */

import { describe, it, expect, beforeEach } from "vite-plus/test";
import { registerCodexProvider, isCodexModel } from "../src/codex-provider.ts";
import { getRegistration, getAgentProvider, clearRegistry } from "../src/registry.ts";
import { CODEX_CAPABILITIES } from "../src/capabilities.ts";

describe("isCodexModel", () => {
  it("matches codex- prefix", () => {
    expect(isCodexModel("codex-mini")).toBe(true);
    expect(isCodexModel("codex-davinci")).toBe(true);
  });

  it("matches o1- prefix", () => {
    expect(isCodexModel("o1-preview")).toBe(true);
    expect(isCodexModel("o1-mini")).toBe(true);
  });

  it("matches o3- prefix", () => {
    expect(isCodexModel("o3-mini")).toBe(true);
  });

  it("matches o4- prefix", () => {
    expect(isCodexModel("o4-mini")).toBe(true);
  });

  it("matches gpt- prefix", () => {
    expect(isCodexModel("gpt-4")).toBe(true);
    expect(isCodexModel("gpt-4o")).toBe(true);
    expect(isCodexModel("gpt-3.5-turbo")).toBe(true);
  });

  it("rejects non-Codex models", () => {
    expect(isCodexModel("claude-3-opus")).toBe(false);
    expect(isCodexModel("sonnet")).toBe(false);
    expect(isCodexModel("random-model")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isCodexModel("GPT-4")).toBe(true);
    expect(isCodexModel("Codex-Mini")).toBe(true);
    expect(isCodexModel("O1-Preview")).toBe(true);
  });
});

describe("CodexProvider (via registry)", () => {
  beforeEach(() => {
    clearRegistry();
    registerCodexProvider();
  });

  it("registers with id 'codex'", () => {
    const reg = getRegistration("codex");
    expect(reg.id).toBe("codex");
    expect(reg.displayName).toBe("Codex (OpenAI)");
    expect(reg.builtIn).toBe(true);
  });

  it("factory creates a provider with id 'codex'", () => {
    const provider = getAgentProvider("codex");
    expect(provider.id).toBe("codex");
  });

  it("query() throws with 'not yet implemented' message", async () => {
    const provider = getAgentProvider("codex");
    await expect(provider.query({ prompt: "test", cwd: "/tmp" })).rejects.toThrow(
      "not yet implemented",
    );
  });

  it("isModelCompatible delegates to isCodexModel", () => {
    const provider = getAgentProvider("codex");
    expect(provider.isModelCompatible("gpt-4")).toBe(true);
    expect(provider.isModelCompatible("codex-mini")).toBe(true);
    expect(provider.isModelCompatible("claude-3-opus")).toBe(false);
  });

  it("getCapabilities returns CODEX_CAPABILITIES", () => {
    const provider = getAgentProvider("codex");
    expect(provider.getCapabilities()).toEqual(CODEX_CAPABILITIES);
  });

  it("registration isModelCompatible matches isCodexModel", () => {
    const reg = getRegistration("codex");
    expect(reg.isModelCompatible("gpt-4")).toBe(true);
    expect(reg.isModelCompatible("claude-3-opus")).toBe(false);
  });

  it("registration capabilities match CODEX_CAPABILITIES", () => {
    const reg = getRegistration("codex");
    expect(reg.capabilities).toEqual(CODEX_CAPABILITIES);
  });
});
