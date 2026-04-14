import { describe, expect, it } from "vite-plus/test";
import { generateWorkflowJsonSchema } from "../../src/schema/generate-json-schema.ts";

describe("generateWorkflowJsonSchema", () => {
  it("produces a JSON Schema with correct structure", () => {
    const schema = generateWorkflowJsonSchema() as Record<string, unknown>;
    // Must be a valid JSON Schema object
    expect(schema).toHaveProperty("type");
    expect(schema).toHaveProperty("properties");
    expect(schema).toHaveProperty("required");
  });

  it("includes workflow-level properties (name, nodes)", () => {
    const schema = generateWorkflowJsonSchema() as Record<string, unknown>;
    const props = schema.properties as Record<string, unknown>;
    expect(props).toHaveProperty("name");
    expect(props).toHaveProperty("nodes");
    expect(props).toHaveProperty("description");
    expect(props).toHaveProperty("model");
  });

  it("targets JSON Schema draft-2020-12", () => {
    const schema = generateWorkflowJsonSchema() as Record<string, unknown>;
    expect(String(schema.$schema)).toContain("2020-12");
  });
});
