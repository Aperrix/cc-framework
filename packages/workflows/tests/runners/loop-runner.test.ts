import { describe, expect, it, vi } from "vite-plus/test";
import { runLoop } from "../../src/runners/loop-runner.ts";
import type { Node } from "../../src/schema/node.ts";
import type { Workflow } from "../../src/schema/workflow.ts";

describe("runLoop", () => {
  it("iterates until the signal is found in output", async () => {
    let callCount = 0;
    const mockRunAi = vi.fn(async () => {
      callCount++;
      return {
        output: callCount >= 3 ? "<promise>COMPLETE</promise>" : "still working",
        sessionId: "sess-1",
      };
    });

    const node = {
      id: "impl",
      loop: {
        prompt: "Do the next step",
        until: "COMPLETE",
        max_iterations: 10,
        fresh_context: false,
      },
    } as unknown as Node;
    const workflow = { name: "test" } as Workflow;

    const result = await runLoop(node, workflow, "/tmp", mockRunAi);
    expect(mockRunAi).toHaveBeenCalledTimes(3);
    expect(result.output).toContain("COMPLETE");
  });

  it("stops at max_iterations", async () => {
    const mockRunAi = vi.fn(async () => ({ output: "not done", sessionId: "s" }));

    const node = {
      id: "impl",
      loop: { prompt: "Do it", until: "DONE", max_iterations: 2, fresh_context: true },
    } as unknown as Node;
    const workflow = { name: "test" } as Workflow;

    const result = await runLoop(node, workflow, "/tmp", mockRunAi);
    expect(mockRunAi).toHaveBeenCalledTimes(2);
    expect(result.output).toBe("not done");
    expect(result.maxIterationsReached).toBe(true);
  });
});
