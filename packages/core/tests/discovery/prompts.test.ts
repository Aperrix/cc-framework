import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { resolvePromptWithConfig, discoverPrompts } from "../../src/discovery/prompts.ts";
import type { ResolvedConfig } from "../../src/config/types.ts";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
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

  it("loads from embedded dir when provided", async () => {
    const embeddedDir = join(tempDir, "embedded");
    await mkdir(embeddedDir, { recursive: true });
    await writeFile(join(embeddedDir, "built-in.md"), "Embedded prompt content");
    const result = await resolvePromptWithConfig("built-in.md", makeConfig(tempDir), embeddedDir);
    expect(result).toBe("Embedded prompt content");
  });

  it("project prompts take priority over embedded", async () => {
    const embeddedDir = join(tempDir, "embedded");
    await mkdir(embeddedDir, { recursive: true });
    await writeFile(join(embeddedDir, "shared.md"), "Embedded version");
    await writeFile(join(tempDir, ".cc-framework", "prompts", "shared.md"), "Project version");
    const result = await resolvePromptWithConfig("shared.md", makeConfig(tempDir), embeddedDir);
    expect(result).toBe("Project version");
  });
});

describe("discoverPrompts", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ccf-prompts-disc-"));
    await mkdir(join(tempDir, ".cc-framework", "prompts"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("discovers prompts from project dir", async () => {
    await writeFile(join(tempDir, ".cc-framework", "prompts", "investigate.md"), "content");
    await writeFile(join(tempDir, ".cc-framework", "prompts", "review.md"), "content");
    const prompts = await discoverPrompts(makeConfig(tempDir));
    expect(prompts).toHaveLength(2);
    expect(prompts.map((p) => p.name).sort()).toEqual(["investigate", "review"]);
  });

  it("returns empty for no prompts", async () => {
    const prompts = await discoverPrompts(makeConfig(tempDir));
    expect(prompts).toHaveLength(0);
  });

  it("project prompts override embedded prompts with same name", async () => {
    const embeddedDir = join(tempDir, "embedded");
    await mkdir(embeddedDir, { recursive: true });
    await writeFile(join(embeddedDir, "shared.md"), "Embedded");
    await writeFile(join(tempDir, ".cc-framework", "prompts", "shared.md"), "Project");
    const prompts = await discoverPrompts(makeConfig(tempDir), embeddedDir);
    expect(prompts).toHaveLength(1);
    expect(prompts[0].source).toBe("project");
  });

  it("discovers embedded prompts", async () => {
    const embeddedDir = join(tempDir, "embedded");
    await mkdir(embeddedDir, { recursive: true });
    await writeFile(join(embeddedDir, "builtin.md"), "Built-in");
    const prompts = await discoverPrompts(makeConfig(tempDir), embeddedDir);
    expect(prompts).toHaveLength(1);
    expect(prompts[0].source).toBe("embedded");
    expect(prompts[0].name).toBe("builtin");
  });
});
