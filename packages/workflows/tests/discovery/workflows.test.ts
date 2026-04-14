import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { discoverWorkflows, findWorkflow } from "../../src/discovery/workflows.ts";
import type { WorkflowConfig } from "../../src/deps.ts";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function makeConfig(
  projectRoot: string,
  globalWorkflows: string,
  embeddedWorkflows: string = "",
): WorkflowConfig {
  return {
    model: "sonnet",
    effort: "high",
    isolation: { strategy: "branch", branch_prefix: "ccf/" },
    paths: {
      embeddedWorkflows,
      globalWorkflows,
      database: "",
      projectRoot,
      projectWorkflows: join(projectRoot, ".cc-framework", "workflows"),
      projectPrompts: join(projectRoot, ".cc-framework", "prompts"),
      projectScripts: join(projectRoot, ".cc-framework", "scripts"),
      docsDir: join(projectRoot, "docs"),
    },
  };
}

describe("discoverWorkflows", () => {
  let tempDir: string;
  let globalDir: string;
  let embeddedDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ccf-wf-test-"));
    globalDir = join(tempDir, "global");
    embeddedDir = join(tempDir, "embedded");
    await mkdir(join(tempDir, ".cc-framework", "workflows"), { recursive: true });
    await mkdir(globalDir, { recursive: true });
    await mkdir(embeddedDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("discovers workflows from all three sources", async () => {
    await writeFile(join(embeddedDir, "fix-issue.yaml"), "name: fix-issue\nnodes: []");
    await writeFile(join(globalDir, "custom.yaml"), "name: custom\nnodes: []");
    await writeFile(
      join(tempDir, ".cc-framework", "workflows", "local.yaml"),
      "name: local\nnodes: []",
    );

    const config = makeConfig(tempDir, globalDir, embeddedDir);
    const workflows = await discoverWorkflows(config);

    expect(workflows).toHaveLength(3);
    expect(workflows.map((w) => w.name).sort()).toEqual(["custom", "fix-issue", "local"]);
  });

  it("project overrides embedded when names collide", async () => {
    await writeFile(join(embeddedDir, "fix-issue.yaml"), "name: embedded-version");
    await writeFile(
      join(tempDir, ".cc-framework", "workflows", "fix-issue.yaml"),
      "name: project-version",
    );

    const config = makeConfig(tempDir, globalDir, embeddedDir);
    const workflows = await discoverWorkflows(config);

    expect(workflows).toHaveLength(1);
    expect(workflows[0].source).toBe("project");
  });

  it("returns empty array when no workflows exist", async () => {
    const config = makeConfig(tempDir, globalDir);
    const workflows = await discoverWorkflows(config);
    expect(workflows).toHaveLength(0);
  });
});

describe("findWorkflow", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ccf-find-test-"));
    await mkdir(join(tempDir, ".cc-framework", "workflows"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("finds a workflow by name", async () => {
    await writeFile(join(tempDir, ".cc-framework", "workflows", "deploy.yaml"), "name: deploy");
    const config = makeConfig(tempDir, "");
    const result = await findWorkflow("deploy", config);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("deploy");
  });

  it("returns null for missing workflow", async () => {
    const config = makeConfig(tempDir, "");
    const result = await findWorkflow("nonexistent", config);
    expect(result).toBeNull();
  });
});
