import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { commandList } from "../../src/commands/list.ts";
import type { ResolvedConfig } from "@cc-framework/core";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function makeConfig(projectRoot: string): ResolvedConfig {
  return {
    model: "sonnet",
    effort: "high",
    isolation: { strategy: "branch", branch_prefix: "ccf/" },
    paths: {
      globalHome: "",
      globalWorkflows: "",
      database: "",
      projectRoot,
      projectConfig: join(projectRoot, ".cc-framework"),
      projectWorkflows: join(projectRoot, ".cc-framework", "workflows"),
      projectPrompts: join(projectRoot, ".cc-framework", "prompts"),
      projectScripts: join(projectRoot, ".cc-framework", "scripts"),
      docsDir: join(projectRoot, "docs"),
    },
  };
}

describe("commandList", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ccf-cli-list-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("lists workflows from project directory", async () => {
    await mkdir(join(tempDir, ".cc-framework", "workflows"), { recursive: true });
    await writeFile(
      join(tempDir, ".cc-framework", "workflows", "fix-issue.yaml"),
      "name: fix-issue\nnodes:\n  - id: x\n    script: echo",
    );

    const result = await commandList(makeConfig(tempDir));
    expect(result).toContain("fix-issue");
    expect(result).toContain("[project]");
  });

  it("shows message when no workflows exist", async () => {
    const result = await commandList(makeConfig(tempDir));
    expect(result).toContain("No workflows");
  });
});
