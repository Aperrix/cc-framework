import { describe, expect, it } from "vite-plus/test";
import { NodeSchema } from "../../src/schema/node.ts";

describe("NodeSchema", () => {
  it("accepts a prompt node with inline text", () => {
    const node = NodeSchema.parse({ id: "plan", prompt: "Create a plan" });
    expect(node.id).toBe("plan");
    expect(node.prompt).toBe("Create a plan");
  });

  it("accepts a prompt node with file path", () => {
    const node = NodeSchema.parse({ id: "plan", prompt: "investigate.md" });
    expect(node.prompt).toBe("investigate.md");
  });

  it("accepts a bash node", () => {
    const node = NodeSchema.parse({ id: "test", bash: "npm test" });
    expect(node.bash).toBe("npm test");
  });

  it("accepts a loop node", () => {
    const node = NodeSchema.parse({
      id: "impl",
      loop: { prompt: "Implement the next task", until: "COMPLETE", max_iterations: 10 },
    });
    expect(node.loop?.prompt).toBe("Implement the next task");
    expect(node.loop?.until).toBe("COMPLETE");
    expect(node.loop?.max_iterations).toBe(10);
  });

  it("accepts an approval node", () => {
    const node = NodeSchema.parse({
      id: "review",
      approval: { message: "Review and approve" },
    });
    expect(node.approval?.message).toBe("Review and approve");
  });

  it("accepts a cancel node", () => {
    const node = NodeSchema.parse({ id: "stop", cancel: "Conflicts detected" });
    expect(node.cancel).toBe("Conflicts detected");
  });

  it("rejects a node with no type", () => {
    expect(() => NodeSchema.parse({ id: "empty" })).toThrow();
  });

  it("rejects a node with multiple types", () => {
    expect(() => NodeSchema.parse({ id: "bad", prompt: "text", bash: "cmd" })).toThrow();
  });

  it("accepts common properties", () => {
    const node = NodeSchema.parse({
      id: "impl",
      prompt: "Implement it",
      depends_on: ["plan"],
      when: "$plan.output.ready == 'true'",
      trigger_rule: "all_success",
      context: "fresh",
      model: "opus",
      allowed_tools: ["Read", "Edit"],
      retry: { max_attempts: 2 },
    });
    expect(node.depends_on).toEqual(["plan"]);
    expect(node.context).toBe("fresh");
    expect(node.model).toBe("opus");
    expect(node.allowed_tools).toEqual(["Read", "Edit"]);
    expect(node.retry?.max_attempts).toBe(2);
  });
});
