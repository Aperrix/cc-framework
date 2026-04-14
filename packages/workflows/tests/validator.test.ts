import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateWorkflowResources } from "../src/validator.ts";
import type { Workflow } from "../src/schema/workflow.ts";

describe("validateWorkflowResources", () => {
  let workflowDir: string;

  beforeEach(async () => {
    workflowDir = await mkdtemp(join(tmpdir(), "ccf-validator-test-"));
  });

  afterEach(async () => {
    await rm(workflowDir, { recursive: true, force: true });
  });

  it("returns valid for workflow with inline prompts and scripts", async () => {
    const workflow = {
      name: "test",
      nodes: [
        {
          id: "step1",
          script: "echo hello",
          depends_on: [],
          trigger_rule: "all_success" as const,
          context: "fresh" as const,
        },
      ],
    } as unknown as Workflow;

    const result = await validateWorkflowResources(workflow, workflowDir);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("returns error when script file reference is missing", async () => {
    const workflow = {
      name: "test",
      nodes: [
        {
          id: "step1",
          script: "./missing-script.sh",
          depends_on: [],
          trigger_rule: "all_success" as const,
          context: "fresh" as const,
        },
      ],
    } as unknown as Workflow;

    const result = await validateWorkflowResources(workflow, workflowDir);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].level).toBe("error");
    expect(result.issues[0].field).toBe("script");
    expect(result.issues[0].nodeId).toBe("step1");
  });

  it("returns error for depends_on referencing non-existent node", async () => {
    const workflow = {
      name: "test",
      nodes: [
        {
          id: "step1",
          script: "echo hello",
          depends_on: ["nonexistent"],
          trigger_rule: "all_success" as const,
          context: "fresh" as const,
        },
      ],
    } as unknown as Workflow;

    const result = await validateWorkflowResources(workflow, workflowDir);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].level).toBe("error");
    expect(result.issues[0].field).toBe("depends_on");
    expect(result.issues[0].message).toContain("nonexistent");
  });

  it("returns warning for when condition referencing node not in depends_on", async () => {
    const workflow = {
      name: "test",
      nodes: [
        {
          id: "step1",
          script: "echo hello",
          depends_on: [],
          trigger_rule: "all_success" as const,
          context: "fresh" as const,
        },
        {
          id: "step2",
          script: "echo world",
          depends_on: [],
          when: "$step1.output == 'ok'",
          trigger_rule: "all_success" as const,
          context: "fresh" as const,
        },
      ],
    } as unknown as Workflow;

    const result = await validateWorkflowResources(workflow, workflowDir);
    // Should still be valid (warning, not error)
    expect(result.valid).toBe(true);
    const warnings = result.issues.filter((i) => i.level === "warning");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].field).toBe("when");
    expect(warnings[0].message).toContain("step1");
    expect(warnings[0].hint).toContain("depends_on");
  });

  it("returns valid when all referenced resources exist", async () => {
    // Create the script file on disk
    await writeFile(join(workflowDir, "run.sh"), "#!/bin/bash\necho ok");

    const workflow = {
      name: "test",
      nodes: [
        {
          id: "step1",
          script: "./run.sh",
          depends_on: [],
          trigger_rule: "all_success" as const,
          context: "fresh" as const,
        },
        {
          id: "step2",
          script: "echo done",
          depends_on: ["step1"],
          when: "$step1.output == 'ok'",
          trigger_rule: "all_success" as const,
          context: "fresh" as const,
        },
      ],
    } as unknown as Workflow;

    const result = await validateWorkflowResources(workflow, workflowDir);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
