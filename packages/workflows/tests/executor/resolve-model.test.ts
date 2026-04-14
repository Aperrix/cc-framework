import { describe, expect, it } from "vite-plus/test";
import { resolveModel } from "../../src/executor/resolve-model.ts";
import type { Workflow } from "../../src/schema/workflow.ts";
import type { Node } from "../../src/schema/node.ts";
import type { WorkflowConfig } from "../../src/deps.ts";
import { WORKFLOW_DEFAULTS } from "../../src/deps.ts";

function makeNode(overrides: Partial<Node> = {}): Node {
  return {
    id: "test-node",
    prompt: "Do something",
    depends_on: [],
    trigger_rule: "all_success",
    context: "fresh",
    ...overrides,
  } as Node;
}

function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    name: "test-wf",
    interactive: false,
    nodes: [],
    ...overrides,
  } as Workflow;
}

describe("resolveModel", () => {
  it("returns node model when set", () => {
    const result = resolveModel(makeNode({ model: "opus" }), makeWorkflow({ model: "haiku" }), {
      ...WORKFLOW_DEFAULTS,
      model: "sonnet",
    });
    expect(result.model).toBe("opus");
    expect(result.source).toBe("node");
  });

  it("falls back to workflow model", () => {
    const result = resolveModel(makeNode(), makeWorkflow({ model: "haiku" }), {
      ...WORKFLOW_DEFAULTS,
      model: "sonnet",
    });
    expect(result.model).toBe("haiku");
    expect(result.source).toBe("workflow");
  });

  it("falls back to config model", () => {
    const result = resolveModel(makeNode(), makeWorkflow(), {
      ...WORKFLOW_DEFAULTS,
      model: "opus",
    });
    expect(result.model).toBe("opus");
    expect(result.source).toBe("config");
  });

  it("falls back to default model", () => {
    const config: WorkflowConfig = { ...WORKFLOW_DEFAULTS, model: "" };
    const result = resolveModel(makeNode(), makeWorkflow(), config);
    expect(result.model).toBe("sonnet");
    expect(result.source).toBe("default");
  });
});
