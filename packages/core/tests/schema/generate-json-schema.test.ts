import { describe, expect, it } from "vite-plus/test";
import { generateWorkflowJsonSchema } from "../../src/schema/generate-json-schema.ts";

describe("generateWorkflowJsonSchema", () => {
  it("produces a valid JSON Schema object", () => {
    const schema = generateWorkflowJsonSchema() as Record<string, unknown>;
    expect(schema).toBeDefined();
    expect(typeof schema).toBe("object");
  });

  it("includes node and workflow properties", () => {
    const schema = generateWorkflowJsonSchema() as Record<string, unknown>;
    const serialized = JSON.stringify(schema);
    expect(serialized).toContain("name");
    expect(serialized).toContain("nodes");
  });

  it("targets draft-2020-12", () => {
    const schema = generateWorkflowJsonSchema() as Record<string, unknown>;
    expect(schema.$schema).toContain("2020-12");
  });
});
