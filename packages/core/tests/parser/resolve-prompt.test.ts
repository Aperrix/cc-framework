import { describe, expect, it } from "vite-plus/test";
import { resolvePrompt } from "../../src/parser/resolve-prompt.ts";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures");

describe("resolvePrompt", () => {
  it("returns inline text as-is", async () => {
    const result = await resolvePrompt("Say hello", fixturesDir);
    expect(result).toBe("Say hello");
  });

  it("loads a .md file from prompts dir", async () => {
    const result = await resolvePrompt("investigate.md", fixturesDir);
    expect(result).toContain("# Investigate Issue");
    expect(result).toContain("root cause summary");
  });

  it("loads a relative path", async () => {
    const result = await resolvePrompt("./prompts/investigate.md", fixturesDir);
    expect(result).toContain("# Investigate Issue");
  });

  it("throws for a missing file", async () => {
    await expect(resolvePrompt("nonexistent.md", fixturesDir)).rejects.toThrow();
  });
});
