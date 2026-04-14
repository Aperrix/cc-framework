import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { WorkflowExecutor } from "../../src/executor/executor.ts";
import { createDatabase, type Database } from "../../src/store/database.ts";
import { StoreQueries } from "../../src/store/queries.ts";
import { WorkflowEventBus } from "../../src/events/event-bus.ts";
import type { Workflow } from "../../src/schema/workflow.ts";

describe("WorkflowExecutor", () => {
  let db: Database;
  let store: StoreQueries;
  let eventBus: WorkflowEventBus;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
    eventBus = new WorkflowEventBus();
  });

  afterEach(() => {
    db.close();
  });

  it("executes a simple sequential workflow with bash nodes", async () => {
    const workflow: Workflow = {
      name: "test-sequential",
      interactive: false,
      nodes: [
        {
          id: "step1",
          script: "echo hello",
          depends_on: [],
          trigger_rule: "all_success",
          context: "fresh",
        },
        {
          id: "step2",
          script: "echo world",
          depends_on: ["step1"],
          trigger_rule: "all_success",
          context: "fresh",
        },
      ],
    } as Workflow;

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp");

    expect(result.status).toBe("completed");
    const outputs = store.getNodeOutputs(result.runId);
    expect(outputs.step1.output.trim()).toBe("hello");
    expect(outputs.step2.output.trim()).toBe("world");
  });

  it("executes parallel nodes concurrently", async () => {
    const workflow: Workflow = {
      name: "test-parallel",
      interactive: false,
      nodes: [
        {
          id: "root",
          script: "echo root",
          depends_on: [],
          trigger_rule: "all_success",
          context: "fresh",
        },
        {
          id: "a",
          script: "echo a",
          depends_on: ["root"],
          trigger_rule: "all_success",
          context: "fresh",
        },
        {
          id: "b",
          script: "echo b",
          depends_on: ["root"],
          trigger_rule: "all_success",
          context: "fresh",
        },
        {
          id: "join",
          script: "echo done",
          depends_on: ["a", "b"],
          trigger_rule: "all_success",
          context: "fresh",
        },
      ],
    } as Workflow;

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp");

    expect(result.status).toBe("completed");
    const outputs = store.getNodeOutputs(result.runId);
    expect(outputs.root).toBeDefined();
    expect(outputs.a).toBeDefined();
    expect(outputs.b).toBeDefined();
    expect(outputs.join).toBeDefined();
  });

  it("skips nodes when 'when' condition is false", async () => {
    const workflow: Workflow = {
      name: "test-conditional",
      interactive: false,
      nodes: [
        {
          id: "check",
          script: 'echo \'{"type":"simple"}\'',
          depends_on: [],
          trigger_rule: "all_success",
          context: "fresh",
        },
        {
          id: "simple",
          script: "echo simple-path",
          depends_on: ["check"],
          when: "$check.output.type == 'simple'",
          trigger_rule: "all_success",
          context: "fresh",
        },
        {
          id: "complex",
          script: "echo complex-path",
          depends_on: ["check"],
          when: "$check.output.type == 'complex'",
          trigger_rule: "all_success",
          context: "fresh",
        },
      ],
    } as Workflow;

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp");

    expect(result.status).toBe("completed");
    const outputs = store.getNodeOutputs(result.runId);
    expect(outputs.simple).toBeDefined();
    expect(outputs.complex).toBeUndefined();
  });

  it("resumes a failed run from the last checkpoint", async () => {
    const stateFile = `/tmp/ccf-resume-test-${Date.now()}`;

    const workflow: Workflow = {
      name: "test-resume",
      interactive: false,
      nodes: [
        {
          id: "step1",
          script: "echo step1-done",
          depends_on: [],
          trigger_rule: "all_success",
          context: "fresh",
        },
        {
          id: "step2",
          script: `if [ ! -f "${stateFile}" ]; then touch "${stateFile}" && exit 1; else echo step2-done; fi`,
          depends_on: ["step1"],
          trigger_rule: "all_success",
          context: "fresh",
        },
      ],
    } as Workflow;

    const executor = new WorkflowExecutor(store, eventBus);

    // First run: step1 succeeds, step2 fails
    const result1 = await executor.run(workflow, "/tmp");
    expect(result1.status).toBe("failed");

    // Verify step1 completed
    const outputs1 = store.getNodeOutputs(result1.runId);
    expect(outputs1.step1.output.trim()).toBe("step1-done");

    // Resume: step1 is skipped (already completed), step2 succeeds
    const result2 = await executor.resume(workflow, result1.runId, "/tmp");
    expect(result2.status).toBe("completed");

    // Verify step2 now completed
    const outputs2 = store.getNodeOutputs(result1.runId);
    expect(outputs2.step2.output.trim()).toBe("step2-done");

    // Cleanup
    const { unlinkSync } = await import("node:fs");
    try {
      unlinkSync(stateFile);
    } catch {}
  });

  it("emits events during execution", async () => {
    const events: string[] = [];
    eventBus.on("node:start", (e) => events.push(`start:${e.nodeId}`));
    eventBus.on("node:complete", (e) => events.push(`complete:${e.nodeId}`));
    eventBus.on("run:done", (e) => events.push(`done:${e.status}`));

    const workflow: Workflow = {
      name: "test-events",
      interactive: false,
      nodes: [
        {
          id: "only",
          script: "echo ok",
          depends_on: [],
          trigger_rule: "all_success",
          context: "fresh",
        },
      ],
    } as Workflow;

    const executor = new WorkflowExecutor(store, eventBus);
    await executor.run(workflow, "/tmp");

    expect(events).toContain("start:only");
    expect(events).toContain("complete:only");
    expect(events).toContain("done:completed");
  });
});
