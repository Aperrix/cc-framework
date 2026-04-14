import { describe, expect, it } from "vite-plus/test";
import {
  NodeSchema,
  isPromptNode,
  isScriptNode,
  isLoopNode,
  isApprovalNode,
  isCancelNode,
} from "../../src/schema/node.ts";

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

  it("accepts a script node (defaults to bash runtime)", () => {
    const node = NodeSchema.parse({ id: "test", script: "npm test" });
    expect(node.script).toBe("npm test");
  });

  it("accepts a script node with explicit runtime", () => {
    const node = NodeSchema.parse({
      id: "test",
      script: "console.log('hi')",
      runtime: "bun",
    });
    expect(node.script).toBe("console.log('hi')");
    expect(node.runtime).toBe("bun");
  });

  it("accepts a script node with deps", () => {
    const node = NodeSchema.parse({
      id: "test",
      script: "print('hi')",
      runtime: "uv",
      deps: ["requests"],
    });
    expect(node.deps).toEqual(["requests"]);
  });

  it("accepts a script node with timeout", () => {
    const node = NodeSchema.parse({
      id: "test",
      script: "sleep 5",
      timeout: 10000,
    });
    expect(node.timeout).toBe(10000);
  });

  it("accepts execution: 'code' on prompt nodes", () => {
    const node = NodeSchema.parse({ id: "gen", prompt: "Generate code", execution: "code" });
    expect(node.execution).toBe("code");
  });

  it("accepts execution: 'code' with runtime on prompt nodes", () => {
    const node = NodeSchema.parse({
      id: "gen",
      prompt: "Generate code",
      execution: "code",
      runtime: "bun",
    });
    expect(node.execution).toBe("code");
    expect(node.runtime).toBe("bun");
  });

  it("accepts execution: 'agent' on prompt nodes", () => {
    const node = NodeSchema.parse({ id: "gen", prompt: "Do something", execution: "agent" });
    expect(node.execution).toBe("agent");
  });

  it("rejects execution on non-prompt nodes", () => {
    expect(() => NodeSchema.parse({ id: "s", script: "echo hi", execution: "code" })).toThrow(
      "'execution' is only valid on prompt nodes",
    );
  });

  it("rejects runtime on non-script nodes without execution: code", () => {
    expect(() => NodeSchema.parse({ id: "bad", prompt: "text", runtime: "bun" })).toThrow(
      "'runtime' is only valid on script nodes or prompt nodes with execution: 'code'",
    );
  });

  it("rejects deps on non-script nodes", () => {
    expect(() => NodeSchema.parse({ id: "bad", prompt: "text", deps: ["foo"] })).toThrow(
      "'deps' is only valid on script nodes",
    );
  });

  it("rejects timeout on non-script nodes", () => {
    expect(() => NodeSchema.parse({ id: "bad", prompt: "text", timeout: 5000 })).toThrow(
      "'timeout' is only valid on script nodes",
    );
  });

  it("accepts a loop node", () => {
    const node = NodeSchema.parse({
      id: "impl",
      loop: {
        prompt: "Implement the next task",
        until: "COMPLETE",
        max_iterations: 10,
      },
    });
    expect(node.loop?.prompt).toBe("Implement the next task");
    expect(node.loop?.until).toBe("COMPLETE");
    expect(node.loop?.max_iterations).toBe(10);
  });

  it("accepts a loop node with until_bash", () => {
    const node = NodeSchema.parse({
      id: "impl",
      loop: {
        prompt: "Fix tests",
        until: "ALL_PASS",
        until_bash: "npm test",
      },
    });
    expect(node.loop?.until_bash).toBe("npm test");
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
    expect(() => NodeSchema.parse({ id: "bad", prompt: "text", script: "cmd" })).toThrow();
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

  it("accepts new fields", () => {
    const node = NodeSchema.parse({
      id: "impl",
      prompt: "Do something",
      provider: "anthropic",
      systemPrompt: "You are a helpful assistant",
      maxBudgetUsd: 0.5,
      thinking: { type: "enabled", budgetTokens: 4096 },
      effort: "high",
      fallbackModel: "sonnet",
      betas: ["interleaved-thinking"],
      mcp: "my-server",
      skills: ["code-review"],
    });
    expect(node.provider).toBe("anthropic");
    expect(node.systemPrompt).toBe("You are a helpful assistant");
    expect(node.maxBudgetUsd).toBe(0.5);
    expect(node.effort).toBe("high");
    expect(node.mcp).toBe("my-server");
    expect(node.skills).toEqual(["code-review"]);
  });
});

describe("type guards", () => {
  it("isPromptNode identifies prompt nodes", () => {
    const node = NodeSchema.parse({ id: "a", prompt: "text" });
    expect(isPromptNode(node)).toBe(true);
    expect(isScriptNode(node)).toBe(false);
  });

  it("isScriptNode identifies script nodes", () => {
    const node = NodeSchema.parse({ id: "a", script: "echo hi" });
    expect(isScriptNode(node)).toBe(true);
    expect(isPromptNode(node)).toBe(false);
  });

  it("isLoopNode identifies loop nodes", () => {
    const node = NodeSchema.parse({
      id: "a",
      loop: { prompt: "go", until: "done" },
    });
    expect(isLoopNode(node)).toBe(true);
  });

  it("isApprovalNode identifies approval nodes", () => {
    const node = NodeSchema.parse({
      id: "a",
      approval: { message: "approve?" },
    });
    expect(isApprovalNode(node)).toBe(true);
  });

  it("isCancelNode identifies cancel nodes", () => {
    const node = NodeSchema.parse({ id: "a", cancel: "stop" });
    expect(isCancelNode(node)).toBe(true);
  });
});
