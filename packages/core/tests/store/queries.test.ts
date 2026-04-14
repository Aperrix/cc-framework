import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { createDatabase, type Database } from "../../src/store/database.ts";
import { StoreQueries } from "../../src/store/queries.ts";

describe("StoreQueries", () => {
  let db: Database;
  let store: StoreQueries;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
  });

  afterEach(() => {
    db.close();
  });

  it("creates and retrieves a workflow", () => {
    const id = store.upsertWorkflow("test-wf", "custom", "hash123");
    const wf = store.getWorkflow(id);
    expect(wf).not.toBeNull();
    expect(wf!.name).toBe("test-wf");
    expect(wf!.source).toBe("custom");
  });

  it("creates and retrieves a run", () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash123");
    const runId = store.createRun(wfId, '{"issue": "42"}');
    const run = store.getRun(runId);
    expect(run).not.toBeNull();
    expect(run!.status).toBe("pending");
    expect(run!.arguments).toBe('{"issue": "42"}');
  });

  it("updates run status", () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash123");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");
    expect(store.getRun(runId)!.status).toBe("running");
    store.updateRunStatus(runId, "completed");
    expect(store.getRun(runId)!.status).toBe("completed");
  });

  it("creates and retrieves node executions", () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash123");
    const runId = store.createRun(wfId);
    const execId = store.createNodeExecution(runId, "investigate", 1);
    const exec = store.getNodeExecution(execId);
    expect(exec).not.toBeNull();
    expect(exec!.node_id).toBe("investigate");
    expect(exec!.attempt).toBe(1);
    expect(exec!.status).toBe("pending");
  });

  it("saves and retrieves node output", () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash123");
    const runId = store.createRun(wfId);
    const execId = store.createNodeExecution(runId, "test-node", 1);
    store.saveOutput(execId, "The answer is 42", null);
    const output = store.getOutput(execId);
    expect(output).not.toBeNull();
    expect(output!.content).toBe("The answer is 42");
  });

  it("records and retrieves events", () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash123");
    const runId = store.createRun(wfId);
    store.recordEvent(runId, "investigate", "start", "{}");
    store.recordEvent(runId, "investigate", "complete", '{"duration": 5000}');
    const events = store.getEvents(runId);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("start");
    expect(events[1].type).toBe("complete");
  });

  it("gets completed node outputs for a run", () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash123");
    const runId = store.createRun(wfId);
    const execId = store.createNodeExecution(runId, "plan", 1);
    store.updateNodeExecutionStatus(execId, "completed", 1500);
    store.saveOutput(execId, "The plan is ready");
    const outputs = store.getNodeOutputs(runId);
    expect(outputs.plan).toBeDefined();
    expect(outputs.plan.output).toBe("The plan is ready");
  });
});
