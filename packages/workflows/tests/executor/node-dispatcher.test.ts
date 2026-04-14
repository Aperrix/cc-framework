import { describe, expect, it } from "vite-plus/test";
import { dispatchNode, type DispatchContext } from "../../src/executor/node-dispatcher.ts";
import { WorkflowEventBus } from "../../src/events/event-bus.ts";
import type { Node } from "../../src/schema/node.ts";
import type { Workflow } from "../../src/schema/workflow.ts";

function makeContext(overrides?: Partial<DispatchContext>): DispatchContext {
  return {
    workflow: { name: "test" } as Workflow,
    config: {
      model: "sonnet",
      effort: "high",
      isolation: { strategy: "branch", branch_prefix: "ccf/" },
      paths: {},
    } as any,
    runId: "run-1",
    nodeId: "test-node",
    cwd: "/tmp",
    builtins: {},
    nodeOutputs: {},
    eventBus: new WorkflowEventBus(),
    ...overrides,
  };
}

describe("dispatchNode", () => {
  it("dispatches script nodes and returns output", async () => {
    const node = {
      id: "s",
      script: "echo hello",
      depends_on: [],
      trigger_rule: "all_success",
      context: "fresh",
    } as Node;
    const result = await dispatchNode(node, makeContext());
    expect(result.output.trim()).toBe("hello");
  });

  it("throws on script failure", async () => {
    const node = {
      id: "s",
      script: "exit 1",
      depends_on: [],
      trigger_rule: "all_success",
      context: "fresh",
    } as Node;
    await expect(dispatchNode(node, makeContext())).rejects.toThrow(/exit code/);
  });

  it("substitutes variables in script", async () => {
    const node = {
      id: "s",
      script: "echo $ARTIFACTS_DIR",
      depends_on: [],
      trigger_rule: "all_success",
      context: "fresh",
    } as Node;
    const result = await dispatchNode(
      node,
      makeContext({ builtins: { ARTIFACTS_DIR: "/tmp/art" } }),
    );
    expect(result.output.trim()).toBe("/tmp/art");
  });

  it("throws for unknown node type", async () => {
    const node = {
      id: "bad",
      depends_on: [],
      trigger_rule: "all_success",
      context: "fresh",
    } as Node;
    await expect(dispatchNode(node, makeContext())).rejects.toThrow(/Unknown node type/);
  });

  it("dispatches cancel nodes by throwing WorkflowCancelledError", async () => {
    const { WorkflowCancelledError } = await import("../../src/runners/cancel-runner.ts");
    const node = {
      id: "c",
      cancel: "stopped",
      depends_on: [],
      trigger_rule: "all_success",
      context: "fresh",
    } as Node;
    await expect(dispatchNode(node, makeContext())).rejects.toThrow(WorkflowCancelledError);
  });

  it("substitutes node output references in script", async () => {
    const node = {
      id: "s",
      script: "echo $analyze.output",
      depends_on: [],
      trigger_rule: "all_success",
      context: "fresh",
    } as Node;
    const result = await dispatchNode(
      node,
      makeContext({ nodeOutputs: { analyze: { output: "previous-result" } } }),
    );
    expect(result.output.trim()).toBe("previous-result");
  });
});
