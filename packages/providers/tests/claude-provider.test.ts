/** Tests for ClaudeProvider using a mocked SDK import. */

import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { ClaudeProvider, isClaudeModel } from "../src/claude-provider.ts";

// Mock the Claude Agent SDK dynamic import
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

/** Create an async iterable that throws on first next(). Avoids require-yield lint. */
function failingIterable(error: Error): AsyncIterable<Record<string, unknown>> {
  return {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<Record<string, unknown>>> {
          throw error;
        },
      };
    },
  };
}

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
    expect(caps.sessionResume).toBe(true);
    expect(caps.toolRestrictions).toBe(true);
    expect(caps.costControl).toBe(true);
    expect(caps.effortControl).toBe(true);
    expect(caps.thinkingControl).toBe(true);
    expect(caps.fallbackModel).toBe(true);
    expect(caps.sandbox).toBe(true);
  });

  it("recognizes compatible models", () => {
    expect(provider.isModelCompatible("claude-3-opus")).toBe(true);
    expect(provider.isModelCompatible("sonnet")).toBe(true);
    expect(provider.isModelCompatible("gpt-4")).toBe(false);
  });

  it("queries the SDK and extracts result", async () => {
    const { query: mockQuery } = await import("@anthropic-ai/claude-agent-sdk");
    const mockedQuery = vi.mocked(mockQuery);

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

  it("propagates non-transient SDK errors immediately", async () => {
    const { query: mockQuery } = await import("@anthropic-ai/claude-agent-sdk");
    const mockedQuery = vi.mocked(mockQuery);

    async function* failingStream() {
      yield { type: "system", subtype: "init", session_id: "sess-err" };
      throw new Error("Invalid API key");
    }
    mockedQuery.mockReturnValue(failingStream() as ReturnType<typeof mockedQuery>);

    await expect(provider.query({ prompt: "Fail", cwd: "/tmp" })).rejects.toThrow(
      "Invalid API key",
    );
    // Non-transient: should NOT retry — only 1 call
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  it("retries on transient error and succeeds", async () => {
    const { query: mockQuery } = await import("@anthropic-ai/claude-agent-sdk");
    const mockedQuery = vi.mocked(mockQuery);

    let callCount = 0;
    mockedQuery.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return failingIterable(new Error("rate limit exceeded")) as ReturnType<typeof mockedQuery>;
      }
      async function* succeed() {
        yield { type: "result", result: "ok" };
      }
      return succeed() as ReturnType<typeof mockedQuery>;
    });

    const result = await provider.query({ prompt: "test", cwd: "/tmp" });
    expect(result.output).toBe("ok");
    expect(callCount).toBe(2);
  });

  it("throws after exhausting retries on transient errors", async () => {
    const { query: mockQuery } = await import("@anthropic-ai/claude-agent-sdk");
    const mockedQuery = vi.mocked(mockQuery);

    let callCount = 0;
    mockedQuery.mockImplementation(() => {
      callCount++;
      return failingIterable(new Error("503 Service Unavailable")) as ReturnType<
        typeof mockedQuery
      >;
    });

    await expect(provider.query({ prompt: "test", cwd: "/tmp" })).rejects.toThrow(
      "503 Service Unavailable",
    );
    // MAX_RETRIES = 2, so 3 total attempts (0, 1, 2)
    expect(callCount).toBe(3);
  });

  it("retries on 429 error", async () => {
    const { query: mockQuery } = await import("@anthropic-ai/claude-agent-sdk");
    const mockedQuery = vi.mocked(mockQuery);

    let callCount = 0;
    mockedQuery.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return failingIterable(new Error("429 Too Many Requests")) as ReturnType<
          typeof mockedQuery
        >;
      }
      async function* succeed() {
        yield { type: "result", result: "recovered" };
      }
      return succeed() as ReturnType<typeof mockedQuery>;
    });

    const result = await provider.query({ prompt: "test", cwd: "/tmp" });
    expect(result.output).toBe("recovered");
    expect(callCount).toBe(2);
  });

  it("retries on 503 error", async () => {
    const { query: mockQuery } = await import("@anthropic-ai/claude-agent-sdk");
    const mockedQuery = vi.mocked(mockQuery);

    let callCount = 0;
    mockedQuery.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return failingIterable(new Error("503 Service Unavailable")) as ReturnType<
          typeof mockedQuery
        >;
      }
      async function* succeed() {
        yield { type: "result", result: "recovered" };
      }
      return succeed() as ReturnType<typeof mockedQuery>;
    });

    const result = await provider.query({ prompt: "test", cwd: "/tmp" });
    expect(result.output).toBe("recovered");
    expect(callCount).toBe(2);
  });

  it("retries on ECONNRESET error", async () => {
    const { query: mockQuery } = await import("@anthropic-ai/claude-agent-sdk");
    const mockedQuery = vi.mocked(mockQuery);

    let callCount = 0;
    mockedQuery.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return failingIterable(new Error("ECONNRESET")) as ReturnType<typeof mockedQuery>;
      }
      async function* succeed() {
        yield { type: "result", result: "recovered" };
      }
      return succeed() as ReturnType<typeof mockedQuery>;
    });

    const result = await provider.query({ prompt: "test", cwd: "/tmp" });
    expect(result.output).toBe("recovered");
    expect(callCount).toBe(2);
  });

  it("does not retry on non-transient 'Invalid API key' error", async () => {
    const { query: mockQuery } = await import("@anthropic-ai/claude-agent-sdk");
    const mockedQuery = vi.mocked(mockQuery);

    let callCount = 0;
    mockedQuery.mockImplementation(() => {
      callCount++;
      return failingIterable(new Error("Invalid API key")) as ReturnType<typeof mockedQuery>;
    });

    await expect(provider.query({ prompt: "test", cwd: "/tmp" })).rejects.toThrow(
      "Invalid API key",
    );
    expect(callCount).toBe(1);
  });

  it("resolves 'sonnet' alias to 'claude-sonnet-4-6' in SDK call", async () => {
    const { query: mockQuery } = await import("@anthropic-ai/claude-agent-sdk");
    const mockedQuery = vi.mocked(mockQuery);

    async function* fakeStream() {
      yield { type: "result", result: "done" };
    }
    mockedQuery.mockReturnValue(fakeStream() as ReturnType<typeof mockedQuery>);

    await provider.query({ prompt: "test", model: "sonnet", cwd: "/tmp" });

    expect(mockedQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          model: "claude-sonnet-4-6",
        }),
      }),
    );
  });

  it("resolves 'opus' alias to 'claude-opus-4-6' in SDK call", async () => {
    const { query: mockQuery } = await import("@anthropic-ai/claude-agent-sdk");
    const mockedQuery = vi.mocked(mockQuery);

    async function* fakeStream() {
      yield { type: "result", result: "done" };
    }
    mockedQuery.mockReturnValue(fakeStream() as ReturnType<typeof mockedQuery>);

    await provider.query({ prompt: "test", model: "opus", cwd: "/tmp" });

    expect(mockedQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          model: "claude-opus-4-6",
        }),
      }),
    );
  });

  it("passes non-alias models through unchanged", async () => {
    const { query: mockQuery } = await import("@anthropic-ai/claude-agent-sdk");
    const mockedQuery = vi.mocked(mockQuery);

    async function* fakeStream() {
      yield { type: "result", result: "done" };
    }
    mockedQuery.mockReturnValue(fakeStream() as ReturnType<typeof mockedQuery>);

    await provider.query({ prompt: "test", model: "claude-3-opus", cwd: "/tmp" });

    expect(mockedQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          model: "claude-3-opus",
        }),
      }),
    );
  });
});
