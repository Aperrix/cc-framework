import { describe, expect, it, afterEach } from "vite-plus/test";
import { stripClaudeCodeMarkers } from "../src/strip-cwd-env.ts";

describe("stripClaudeCodeMarkers", () => {
  const savedEnv: Record<string, string | undefined> = {};

  function setEnv(key: string, value: string): void {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
  }

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    // Clear saved env for next test
    for (const key of Object.keys(savedEnv)) {
      delete savedEnv[key];
    }
  });

  it("strips CLAUDECODE marker", () => {
    setEnv("CLAUDECODE", "1");
    stripClaudeCodeMarkers();
    expect(process.env.CLAUDECODE).toBeUndefined();
  });

  it("strips CLAUDE_CODE_SSE_PORT", () => {
    setEnv("CLAUDE_CODE_SSE_PORT", "12345");
    stripClaudeCodeMarkers();
    expect(process.env.CLAUDE_CODE_SSE_PORT).toBeUndefined();
  });

  it("keeps CLAUDE_CODE_OAUTH_TOKEN", () => {
    setEnv("CLAUDE_CODE_OAUTH_TOKEN", "token-value");
    stripClaudeCodeMarkers();
    expect(process.env.CLAUDE_CODE_OAUTH_TOKEN).toBe("token-value");
  });

  it("keeps CLAUDE_CODE_USE_BEDROCK", () => {
    setEnv("CLAUDE_CODE_USE_BEDROCK", "true");
    stripClaudeCodeMarkers();
    expect(process.env.CLAUDE_CODE_USE_BEDROCK).toBe("true");
  });

  it("keeps CLAUDE_CODE_USE_VERTEX", () => {
    setEnv("CLAUDE_CODE_USE_VERTEX", "true");
    stripClaudeCodeMarkers();
    expect(process.env.CLAUDE_CODE_USE_VERTEX).toBe("true");
  });

  it("strips NODE_OPTIONS", () => {
    setEnv("NODE_OPTIONS", "--inspect");
    stripClaudeCodeMarkers();
    expect(process.env.NODE_OPTIONS).toBeUndefined();
  });

  it("strips VSCODE_INSPECTOR_OPTIONS", () => {
    setEnv("VSCODE_INSPECTOR_OPTIONS", "some-value");
    stripClaudeCodeMarkers();
    expect(process.env.VSCODE_INSPECTOR_OPTIONS).toBeUndefined();
  });
});
