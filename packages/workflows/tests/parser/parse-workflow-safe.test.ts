import { describe, expect, it } from "vite-plus/test";
import { parseWorkflow, parseWorkflowSafe } from "../../src/parser/parse-workflow.ts";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import type { ResolvedConfig } from "@cc-framework/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures");

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
      projectPrompts: join(projectRoot, "prompts"),
      projectScripts: join(projectRoot, ".cc-framework", "scripts"),
      docsDir: join(projectRoot, "docs"),
    },
  };
}

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "ccf-safe-test-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("parseWorkflowSafe", () => {
  it("returns workflow and no errors for a valid file", async () => {
    const result = await parseWorkflowSafe(
      join(fixturesDir, "minimal.yaml"),
      makeConfig(fixturesDir),
    );
    expect(result.errors).toEqual([]);
    expect(result.workflow).not.toBeNull();
    expect(result.workflow!.name).toBe("minimal-test");
    expect(result.workflow!.nodes).toHaveLength(1);
  });

  it("returns errors for multiple invalid nodes with nodeId context", async () => {
    await withTempDir(async (dir) => {
      const yamlPath = join(dir, "multi-invalid.yaml");
      await writeFile(
        yamlPath,
        `
name: multi-invalid
nodes:
  - id: node1
    prompt: "valid"
  - id: node2
  - id: ""
    script: "echo hi"
`,
      );
      const result = await parseWorkflowSafe(yamlPath, makeConfig(dir));
      expect(result.workflow).toBeNull();
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      // node2 has no type field
      const node2Errors = result.errors.filter((e) => e.nodeId === "node2");
      expect(node2Errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("returns error with nodeId for missing prompt file", async () => {
    await withTempDir(async (dir) => {
      const yamlPath = join(dir, "missing-prompt.yaml");
      await writeFile(
        yamlPath,
        `
name: missing-prompt
nodes:
  - id: step1
    prompt: "nonexistent-file.md"
`,
      );
      const result = await parseWorkflowSafe(yamlPath, makeConfig(dir));
      expect(result.workflow).toBeNull();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].nodeId).toBe("step1");
      expect(result.errors[0].field).toBe("prompt");
      expect(result.errors[0].message).toContain("resolve prompt");
    });
  });

  it("returns error for duplicate node IDs", async () => {
    await withTempDir(async (dir) => {
      const yamlPath = join(dir, "dup-ids.yaml");
      await writeFile(
        yamlPath,
        `
name: dup-ids
nodes:
  - id: step1
    script: "echo hello"
  - id: step1
    script: "echo world"
`,
      );
      const result = await parseWorkflowSafe(yamlPath, makeConfig(dir));
      expect(result.workflow).toBeNull();
      const dupErrors = result.errors.filter((e) => e.message.includes("Duplicate node ID"));
      expect(dupErrors).toHaveLength(1);
      expect(dupErrors[0].nodeId).toBe("step1");
    });
  });

  it("returns error with nodeId for invalid depends_on reference", async () => {
    await withTempDir(async (dir) => {
      const yamlPath = join(dir, "bad-dep.yaml");
      await writeFile(
        yamlPath,
        `
name: bad-dep
nodes:
  - id: step1
    script: "echo hello"
  - id: step2
    script: "echo world"
    depends_on: [nonexistent]
`,
      );
      const result = await parseWorkflowSafe(yamlPath, makeConfig(dir));
      expect(result.workflow).toBeNull();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].nodeId).toBe("step2");
      expect(result.errors[0].message).toContain("nonexistent");
    });
  });

  it("returns top-level error when name is missing", async () => {
    await withTempDir(async (dir) => {
      const yamlPath = join(dir, "no-name.yaml");
      await writeFile(
        yamlPath,
        `
nodes:
  - id: step1
    script: "echo hello"
`,
      );
      const result = await parseWorkflowSafe(yamlPath, makeConfig(dir));
      expect(result.workflow).toBeNull();
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      // Should not have a nodeId since it's a top-level error
      expect(result.errors[0].nodeId).toBeUndefined();
    });
  });

  it("returns error when file does not exist", async () => {
    const result = await parseWorkflowSafe("/no/such/file.yaml", makeConfig("/no/such"));
    expect(result.workflow).toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Failed to read");
  });
});

describe("parseWorkflow backward compatibility", () => {
  it("still throws on errors", async () => {
    await withTempDir(async (dir) => {
      const yamlPath = join(dir, "dup-ids.yaml");
      await writeFile(
        yamlPath,
        `
name: dup-ids
nodes:
  - id: step1
    script: "echo hello"
  - id: step1
    script: "echo world"
`,
      );
      await expect(parseWorkflow(yamlPath, makeConfig(dir))).rejects.toThrow(
        /Duplicate node ID: "step1"/,
      );
    });
  });

  it("returns workflow on valid input", async () => {
    const wf = await parseWorkflow(join(fixturesDir, "minimal.yaml"), makeConfig(fixturesDir));
    expect(wf.name).toBe("minimal-test");
    expect(wf.nodes).toHaveLength(1);
  });
});
