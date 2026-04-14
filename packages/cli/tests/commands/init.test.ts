import { describe, expect, it, afterEach } from "vite-plus/test";
import { commandInit } from "../../src/commands/init.ts";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("commandInit", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it("creates .cc-framework directory structure", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ccf-cli-init-"));
    const result = await commandInit(tempDir);
    expect(result).toContain("Initialized");
    expect((await stat(join(tempDir, ".cc-framework", "workflows"))).isDirectory()).toBe(true);
    expect((await stat(join(tempDir, ".cc-framework", "prompts"))).isDirectory()).toBe(true);
    expect((await stat(join(tempDir, ".cc-framework", "scripts"))).isDirectory()).toBe(true);
  });
});
