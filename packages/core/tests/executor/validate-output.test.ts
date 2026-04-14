import { describe, expect, it } from "vite-plus/test";
import { validateNodeOutput } from "../../src/executor/validate-output.ts";
import type { Node } from "../../src/schema/node.ts";

function makeNode(outputFormat?: Record<string, unknown>): Node {
  return {
    id: "test",
    prompt: "test",
    depends_on: [],
    trigger_rule: "all_success",
    context: "fresh",
    output_format: outputFormat,
  } as Node;
}

describe("validateNodeOutput", () => {
  it("passes when no output_format is declared", () => {
    const result = validateNodeOutput(makeNode(), "anything");
    expect(result.valid).toBe(true);
  });

  it("passes for valid JSON matching schema", () => {
    const node = makeNode({
      type: "object",
      properties: { type: { type: "string", enum: ["bug", "feature"] } },
      required: ["type"],
    });
    const result = validateNodeOutput(node, JSON.stringify({ type: "bug" }));
    expect(result.valid).toBe(true);
  });

  it("fails for non-JSON output", () => {
    const node = makeNode({ type: "object", properties: {} });
    const result = validateNodeOutput(node, "not json");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("not valid JSON");
  });

  it("fails for missing required fields", () => {
    const node = makeNode({
      type: "object",
      properties: { severity: { type: "string" } },
      required: ["severity"],
    });
    const result = validateNodeOutput(node, JSON.stringify({ other: "value" }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("severity");
  });

  it("fails for wrong type", () => {
    const node = makeNode({
      type: "object",
      properties: { count: { type: "number" } },
    });
    const result = validateNodeOutput(node, JSON.stringify({ count: "not a number" }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("must be a number");
  });

  it("fails for invalid enum value", () => {
    const node = makeNode({
      type: "object",
      properties: { status: { type: "string", enum: ["open", "closed"] } },
    });
    const result = validateNodeOutput(node, JSON.stringify({ status: "pending" }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("must be one of");
  });

  it("collects multiple errors", () => {
    const node = makeNode({
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name", "age"],
    });
    const result = validateNodeOutput(node, JSON.stringify({}));
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});
