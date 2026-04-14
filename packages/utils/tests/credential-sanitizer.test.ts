import { describe, expect, it } from "vite-plus/test";
import { sanitize, sanitizeSync, addPattern } from "../src/credential-sanitizer.ts";

describe("sanitize (async — secretlint + regex)", () => {
  it("redacts Anthropic API keys (sk-ant-...)", async () => {
    const input = "key is sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890";
    expect(await sanitize(input)).toBe("key is [REDACTED]");
  });

  it("redacts OpenAI project keys (sk-proj-...)", async () => {
    const input = "key=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890";
    expect(await sanitize(input)).toBe("key=[REDACTED]");
  });

  it("redacts Bearer tokens", async () => {
    const input = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature";
    const result = await sanitize(input);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("eyJ");
  });

  it("leaves normal text unchanged", async () => {
    const input = "This is a normal log line with no secrets.";
    expect(await sanitize(input)).toBe(input);
  });

  it("redacts URLs with passwords", async () => {
    const input = "connecting to https://admin:supersecretpassword@db.example.com:5432";
    const result = await sanitize(input);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("supersecretpassword");
  });
});

describe("sanitizeSync (regex only)", () => {
  it("redacts Anthropic API keys", () => {
    const input = "key is sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890";
    expect(sanitizeSync(input)).toBe("key is [REDACTED]");
  });

  it("redacts GitHub PATs (ghp_...)", () => {
    const input = "token: ghp_abcdefghijklmnopqrstuvwxyz12345678";
    expect(sanitizeSync(input)).toBe("token: [REDACTED]");
  });

  it("redacts Stripe keys", () => {
    const input = "sk_live_abcdefghijklmnopqrstuvwxyz1234567890";
    expect(sanitizeSync(input)).toBe("[REDACTED]");
  });

  it("redacts env var patterns with secret-like names", () => {
    const input = "API_SECRET=abcdefghijklmnopqrstuvwxyz1234567890ABCDEF";
    expect(sanitizeSync(input)).toBe("API_SECRET=[REDACTED]");
  });

  it("leaves normal text unchanged", () => {
    expect(sanitizeSync("This is a normal log line.")).toBe("This is a normal log line.");
  });

  it("leaves short tokens unchanged", () => {
    expect(sanitizeSync("session=abc123")).toBe("session=abc123");
  });

  it("supports custom patterns via addPattern", () => {
    addPattern(/CUSTOM-\d{10}/g, "[CUSTOM_REDACTED]");
    expect(sanitizeSync("id: CUSTOM-1234567890")).toBe("id: [CUSTOM_REDACTED]");
  });

  it("can be called multiple times without regex state issues", () => {
    const input = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890";
    expect(sanitizeSync(input)).toBe("[REDACTED]");
    expect(sanitizeSync(input)).toBe("[REDACTED]");
  });
});
