import { describe, expect, it } from "vite-plus/test";
import { sanitize, addPattern } from "../src/credential-sanitizer.ts";

describe("sanitize", () => {
  it("redacts Anthropic API keys (sk-ant-...)", () => {
    const input = "key is sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890";
    expect(sanitize(input)).toBe("key is [REDACTED]");
  });

  it("redacts OpenAI project keys (sk-proj-...)", () => {
    const input = "key=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890";
    expect(sanitize(input)).toBe("key=[REDACTED]");
  });

  it("redacts GitHub PATs (ghp_...)", () => {
    const input = "token: ghp_abcdefghijklmnopqrstuvwxyz12345678";
    expect(sanitize(input)).toBe("token: [REDACTED]");
  });

  it("redacts GitHub PATs (github_pat_...)", () => {
    const input = "github_pat_abcdefghijklmnopqrstuvwxyz12345678";
    expect(sanitize(input)).toBe("[REDACTED]");
  });

  it("redacts Bearer tokens", () => {
    const input = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature";
    expect(sanitize(input)).toContain("Bearer [REDACTED]");
    expect(sanitize(input)).not.toContain("eyJ");
  });

  it("leaves normal text unchanged", () => {
    const input = "This is a normal log line with no secrets.";
    expect(sanitize(input)).toBe(input);
  });

  it("leaves short tokens unchanged", () => {
    const input = "session=abc123";
    expect(sanitize(input)).toBe(input);
  });

  it("redacts URLs with passwords", () => {
    const input = "connecting to https://admin:supersecretpassword@db.example.com:5432";
    const result = sanitize(input);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("supersecretpassword");
    expect(result).toContain("db.example.com");
  });

  it("redacts environment variable patterns with long values", () => {
    const input = "API_KEY=abcdefghijklmnopqrstuvwxyz1234567890ABCDEF";
    const result = sanitize(input);
    expect(result).toBe("API_KEY=[REDACTED]");
  });

  it("supports custom patterns via addPattern", () => {
    addPattern(/CUSTOM-\d{10}/g, "[CUSTOM_REDACTED]");
    const input = "id: CUSTOM-1234567890";
    expect(sanitize(input)).toBe("id: [CUSTOM_REDACTED]");
  });

  it("can be called multiple times without regex state issues", () => {
    const input = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890";
    expect(sanitize(input)).toBe("[REDACTED]");
    expect(sanitize(input)).toBe("[REDACTED]");
  });
});
