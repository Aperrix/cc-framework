import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { resolvePromptWithConfig } from "../../src/discovery/prompts.ts";
import type { ResolvedConfig } from "@cc-framework/core";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function makeConfig(projectRoot: string): ResolvedConfig {
  return {
    model: "sonnet",
    effort: "high",
    isolation: { strategy: "branch", branch_prefix: "ccf/" },
    paths: {
      embeddedWorkflows: "",
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

describe("resolvePromptWithConfig", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ccf-prompts-test-"));
    await mkdir(join(tempDir, ".cc-framework", "prompts"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns inline text as-is", async () => {
    const result = await resolvePromptWithConfig("Just a prompt", makeConfig(tempDir));
    expect(result).toBe("Just a prompt");
  });

  it("loads .md file from project prompts dir", async () => {
    await writeFile(
      join(tempDir, ".cc-framework", "prompts", "investigate.md"),
      "# Investigate\nDo the thing.",
    );
    const result = await resolvePromptWithConfig("investigate.md", makeConfig(tempDir));
    expect(result).toContain("# Investigate");
  });

  it("loads relative path from project root", async () => {
    await writeFile(join(tempDir, "custom.md"), "Custom prompt");
    const result = await resolvePromptWithConfig("./custom.md", makeConfig(tempDir));
    expect(result).toBe("Custom prompt");
  });

  it("throws for missing file", async () => {
    await expect(resolvePromptWithConfig("missing.md", makeConfig(tempDir))).rejects.toThrow(
      /not found/,
    );
  });

  it("loads from workflow directory when provided", async () => {
    const workflowDir = join(tempDir, "workflows", "my-workflow");
    await mkdir(workflowDir, { recursive: true });
    await writeFile(join(workflowDir, "built-in.md"), "Workflow prompt content");
    const result = await resolvePromptWithConfig("built-in.md", makeConfig(tempDir), workflowDir);
    expect(result).toBe("Workflow prompt content");
  });

  it("project prompts take priority over workflow dir", async () => {
    const workflowDir = join(tempDir, "workflows", "my-workflow");
    await mkdir(workflowDir, { recursive: true });
    await writeFile(join(workflowDir, "shared.md"), "Workflow version");
    await writeFile(join(tempDir, ".cc-framework", "prompts", "shared.md"), "Project version");
    const result = await resolvePromptWithConfig("shared.md", makeConfig(tempDir), workflowDir);
    expect(result).toBe("Project version");
  });
});
