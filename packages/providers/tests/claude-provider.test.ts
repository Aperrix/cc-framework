/** Tests for ClaudeProvider using a mocked SDK import. */

import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { ClaudeProvider, isClaudeModel } from "../src/claude-provider.ts";

// Mock the Claude Agent SDK dynamic import
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

describe("isClaudeModel", () => {
  it("matches claude- prefixed models", () => {
    expect(isClaudeModel("claude-3-opus")).toBe(true);
    expect(isClaudeModel("claude-haiku-4-5-20251001")).toBe(true);
  });

  it("matches shorthand aliases", () => {
    expect(isClaudeModel("sonnet")).toBe(true);
    expect(isClaudeModel("opus")).toBe(true);
    expect(isClaudeModel("haiku")).toBe(true);
    expect(isClaudeModel("Sonnet")).toBe(true);
  });

  it("rejects non-Claude models", () => {
    expect(isClaudeModel("gpt-4")).toBe(false);
    expect(isClaudeModel("codex-mini")).toBe(false);
    expect(isClaudeModel("o1-preview")).toBe(false);
  });
});

describe("ClaudeProvider", () => {
  let provider: ClaudeProvider;

  beforeEach(() => {
    provider = new ClaudeProvider();
    vi.clearAllMocks();
  });

  it("has id 'claude'", () => {
    expect(provider.id).toBe("claude");
  });

  it("reports correct capabilities", () => {
    const caps = provider.getCapabilities();
    expect(caps.supportsMcp).toBe(true);
    expect(caps.supportsTools).toBe(true);
    expect(caps.supportsThinking).toBe(true);
    expect(caps.maxContextTokens).toBe(200_000);
  });

  it("recognizes compatible models", () => {
    expect(provider.isModelCompatible("claude-3-opus")).toBe(true);
    expect(provider.isModelCompatible("sonnet")).toBe(true);
    expect(provider.isModelCompatible("gpt-4")).toBe(false);
  });

  it("queries the SDK and extracts result", async () => {
    const { query: mockQuery } = await import("@anthropic-ai/claude-agent-sdk");
    const mockedQuery = vi.mocked(mockQuery);

    // Simulate SDK yielding init + result messages
    async function* fakeStream() {
      yield { type: "system", subtype: "init", session_id: "sess-123" };
      yield { type: "result", result: "Hello world" };
    }
    mockedQuery.mockReturnValue(fakeStream() as ReturnType<typeof mockedQuery>);

    const result = await provider.query({ prompt: "Say hello", model: "sonnet", cwd: "/tmp" });

    expect(result.output).toBe("Hello world");
    expect(result.sessionId).toBe("sess-123");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(mockedQuery).toHaveBeenCalledOnce();
  });

  it("propagates SDK errors", async () => {
    const { query: mockQuery } = await import("@anthropic-ai/claude-agent-sdk");
    const mockedQuery = vi.mocked(mockQuery);

    async function* failingStream() {
      yield { type: "system", subtype: "init", session_id: "sess-err" };
      throw new Error("Network timeout");
    }
    mockedQuery.mockReturnValue(failingStream() as ReturnType<typeof mockedQuery>);

    await expect(provider.query({ prompt: "Fail", cwd: "/tmp" })).rejects.toThrow(
      "Network timeout",
    );
  });
});
