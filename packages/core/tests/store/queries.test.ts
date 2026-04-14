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
    expect(exec!.nodeId).toBe("investigate");
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

  // ---- Metrics ----

  it("returns workflow stats with success rate", () => {
    const wfId = store.upsertWorkflow("metrics-wf", "custom", "hash");

    // Create 3 runs: 2 completed, 1 failed
    const run1 = store.createRun(wfId);
    store.updateRunStatus(run1, "running");
    store.updateRunStatus(run1, "completed");

    const run2 = store.createRun(wfId);
    store.updateRunStatus(run2, "running");
    store.updateRunStatus(run2, "completed");

    const run3 = store.createRun(wfId);
    store.updateRunStatus(run3, "running");
    store.updateRunStatus(run3, "failed");

    const stats = store.getWorkflowStats("metrics-wf");
    expect(stats.totalRuns).toBe(3);
    expect(stats.completedRuns).toBe(2);
    expect(stats.failedRuns).toBe(1);
    expect(stats.successRate).toBeCloseTo(2 / 3);
  });

  it("returns node failure ranking", () => {
    const wfId = store.upsertWorkflow("ranking-wf", "custom", "hash");

    const run1 = store.createRun(wfId);
    const exec1 = store.createNodeExecution(run1, "flaky-node", 1);
    store.updateNodeExecutionStatus(exec1, "failed");
    const exec2 = store.createNodeExecution(run1, "stable-node", 1);
    store.updateNodeExecutionStatus(exec2, "completed");

    const run2 = store.createRun(wfId);
    const exec3 = store.createNodeExecution(run2, "flaky-node", 1);
    store.updateNodeExecutionStatus(exec3, "failed");

    const stats = store.getWorkflowStats("ranking-wf");
    expect(stats.nodeFailureRanking).toHaveLength(1);
    expect(stats.nodeFailureRanking[0].nodeId).toBe("flaky-node");
    expect(stats.nodeFailureRanking[0].failureCount).toBe(2);
  });

  it("returns empty stats for unknown workflow", () => {
    const stats = store.getWorkflowStats("nonexistent");
    expect(stats.totalRuns).toBe(0);
    expect(stats.successRate).toBe(0);
  });
});
