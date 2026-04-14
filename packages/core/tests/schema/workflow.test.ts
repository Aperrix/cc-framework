import { describe, expect, it } from "vite-plus/test";
import { WorkflowSchema } from "../../src/schema/workflow.ts";

describe("WorkflowSchema", () => {
  it("parses a minimal workflow", () => {
    const wf = WorkflowSchema.parse({
      name: "test-workflow",
      nodes: [{ id: "step1", prompt: "Do something" }],
    });
    expect(wf.name).toBe("test-workflow");
    expect(wf.nodes).toHaveLength(1);
  });

  it("parses a full workflow with all top-level properties", () => {
    const wf = WorkflowSchema.parse({
      name: "full-workflow",
      description: "A complete workflow",
      model: "opus",
      effort: "high",
      thinking: "adaptive",
      isolation: { strategy: "worktree" },
      inputs: {
        issue: { type: "string", required: true, description: "Issue number" },
      },
      nodes: [
        { id: "investigate", prompt: "Investigate issue" },
        { id: "fix", prompt: "Fix the bug", depends_on: ["investigate"] },
      ],
    });
    expect(wf.description).toBe("A complete workflow");
    expect(wf.model).toBe("opus");
    expect(wf.isolation?.strategy).toBe("worktree");
    expect(wf.inputs?.issue.type).toBe("string");
    expect(wf.nodes).toHaveLength(2);
  });

  it("rejects a workflow with no name", () => {
    expect(() => WorkflowSchema.parse({ nodes: [{ id: "s", prompt: "p" }] })).toThrow();
  });

  it("rejects a workflow with no nodes", () => {
    expect(() => WorkflowSchema.parse({ name: "empty" })).toThrow();
  });

  it("rejects a workflow with empty nodes", () => {
    expect(() => WorkflowSchema.parse({ name: "empty", nodes: [] })).toThrow();
  });
});
