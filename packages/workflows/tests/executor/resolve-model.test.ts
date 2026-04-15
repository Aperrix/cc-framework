import { describe, expect, it } from "vite-plus/test";
import { resolveModel, expandModelAlias } from "../../src/executor/resolve-model.ts";
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

describe("expandModelAlias", () => {
  it("expands shorthand aliases", () => {
    expect(expandModelAlias("sonnet")).toBe("claude-sonnet-4-6");
    expect(expandModelAlias("opus")).toBe("claude-opus-4-6");
    expect(expandModelAlias("haiku")).toBe("claude-haiku-4-5-20251001");
  });

  it("is case-insensitive", () => {
    expect(expandModelAlias("Sonnet")).toBe("claude-sonnet-4-6");
    expect(expandModelAlias("OPUS")).toBe("claude-opus-4-6");
  });

  it("returns full model names as-is", () => {
    expect(expandModelAlias("claude-sonnet-4-6")).toBe("claude-sonnet-4-6");
    expect(expandModelAlias("gpt-4")).toBe("gpt-4");
  });
});

describe("resolveModel", () => {
  it("returns node model when set (expanded)", () => {
    const result = resolveModel(makeNode({ model: "opus" }), makeWorkflow({ model: "haiku" }), {
      ...WORKFLOW_DEFAULTS,
      model: "sonnet",
    });
    expect(result.model).toBe("claude-opus-4-6");
    expect(result.source).toBe("node");
  });

  it("falls back to workflow model (expanded)", () => {
    const result = resolveModel(makeNode(), makeWorkflow({ model: "haiku" }), {
      ...WORKFLOW_DEFAULTS,
      model: "sonnet",
    });
    expect(result.model).toBe("claude-haiku-4-5-20251001");
    expect(result.source).toBe("workflow");
  });

  it("falls back to config model (expanded)", () => {
    const result = resolveModel(makeNode(), makeWorkflow(), {
      ...WORKFLOW_DEFAULTS,
      model: "opus",
    });
    expect(result.model).toBe("claude-opus-4-6");
    expect(result.source).toBe("config");
  });

  it("falls back to default model (expanded)", () => {
    const config: WorkflowConfig = { ...WORKFLOW_DEFAULTS, model: "" };
    const result = resolveModel(makeNode(), makeWorkflow(), config);
    expect(result.model).toBe("claude-sonnet-4-6");
    expect(result.source).toBe("default");
  });

  it("passes through full model names", () => {
    const result = resolveModel(
      makeNode({ model: "claude-haiku-4-5-20251001" }),
      makeWorkflow(),
      WORKFLOW_DEFAULTS,
    );
    expect(result.model).toBe("claude-haiku-4-5-20251001");
  });
});
