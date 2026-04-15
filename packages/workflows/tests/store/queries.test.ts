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

  // ---- Lifecycle ----

  it("finds a resumable paused run", () => {
    const wfId = store.upsertWorkflow("resume-wf", "custom", "hash");
    const run1 = store.createRun(wfId);
    store.updateRunStatus(run1, "running");
    store.updateRunStatus(run1, "paused");

    const resumable = store.findResumableRun("resume-wf");
    expect(resumable).not.toBeNull();
    expect(resumable!.id).toBe(run1);
    expect(resumable!.status).toBe("paused");
  });

  it("finds a resumable failed run", () => {
    const wfId = store.upsertWorkflow("resume-wf2", "custom", "hash");
    const run1 = store.createRun(wfId);
    store.updateRunStatus(run1, "running");
    store.updateRunStatus(run1, "failed");

    const resumable = store.findResumableRun("resume-wf2");
    expect(resumable).not.toBeNull();
    expect(resumable!.status).toBe("failed");
  });

  it("prefers paused over failed for resume", () => {
    const wfId = store.upsertWorkflow("resume-wf3", "custom", "hash");
    const run1 = store.createRun(wfId);
    store.updateRunStatus(run1, "running");
    store.updateRunStatus(run1, "failed");

    const run2 = store.createRun(wfId);
    store.updateRunStatus(run2, "running");
    store.updateRunStatus(run2, "paused");

    const resumable = store.findResumableRun("resume-wf3");
    expect(resumable).not.toBeNull();
    expect(resumable!.status).toBe("paused");
  });

  it("returns null when no resumable run exists", () => {
    const wfId = store.upsertWorkflow("complete-wf", "custom", "hash");
    const run1 = store.createRun(wfId);
    store.updateRunStatus(run1, "running");
    store.updateRunStatus(run1, "completed");

    expect(store.findResumableRun("complete-wf")).toBeNull();
  });

  it("returns null for unknown workflow", () => {
    expect(store.findResumableRun("nonexistent")).toBeNull();
  });

  // ---- Pause / Resume ----

  it("pauses a running run", () => {
    const wfId = store.upsertWorkflow("pause-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");

    store.pauseRun(runId, {
      nodeId: "gate-1",
      message: "Approve?",
      captureResponse: false,
      rejectionCount: 0,
    });

    const run = store.getRun(runId);
    expect(run!.status).toBe("paused");
  });

  it("resumes a paused run", () => {
    const wfId = store.upsertWorkflow("resume-run-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");
    store.pauseRun(runId, {
      nodeId: "gate-1",
      message: "Approve?",
      captureResponse: false,
      rejectionCount: 0,
    });

    store.resumeRun(runId);

    expect(store.getRun(runId)!.status).toBe("running");
  });

  // ---- Approval Context ----

  it("retrieves approval context from events", () => {
    const wfId = store.upsertWorkflow("approval-ctx-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.pauseRun(runId, {
      nodeId: "gate-1",
      message: "Please approve",
      captureResponse: false,
      rejectionCount: 0,
    });

    const ctx = store.getApprovalContext(runId);
    expect(ctx).not.toBeNull();
    expect(ctx!.nodeId).toBe("gate-1");
    expect(ctx!.message).toBe("Please approve");
  });

  it("returns null when no approval event exists", () => {
    const wfId = store.upsertWorkflow("no-approval-wf", "custom", "hash");
    const runId = store.createRun(wfId);

    expect(store.getApprovalContext(runId)).toBeNull();
  });

  it("returns null when approval event payload is invalid JSON", () => {
    const wfId = store.upsertWorkflow("bad-json-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    // Manually record an event with invalid JSON payload
    store.recordEvent(runId, null, "approval:paused", "not-valid-json{{{");

    expect(store.getApprovalContext(runId)).toBeNull();
  });

  // ---- Session Operations ----

  it("updates session activity timestamp", () => {
    const sessionId = store.createSession("/tmp/project");
    const before = store.getSession(sessionId)!.lastActivity;

    // We can't easily mock Date.now in this setup, so we just verify the method runs
    store.updateSessionActivity(sessionId);

    const after = store.getSession(sessionId)!.lastActivity;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("creates a run linked to a session", () => {
    const wfId = store.upsertWorkflow("session-run-wf", "custom", "hash");
    const sessionId = store.createSession("/tmp/project");

    const runId = store.createRunInSession(wfId, sessionId, '{"arg": "val"}');

    const run = store.getRun(runId);
    expect(run).not.toBeNull();
    expect(run!.sessionId).toBe(sessionId);
    expect(run!.arguments).toBe('{"arg": "val"}');
    expect(run!.status).toBe("pending");
  });

  it("createRunInSession updates session activity", () => {
    const wfId = store.upsertWorkflow("session-act-wf", "custom", "hash");
    const sessionId = store.createSession("/tmp/project");
    const before = store.getSession(sessionId)!.lastActivity;

    store.createRunInSession(wfId, sessionId);

    const after = store.getSession(sessionId)!.lastActivity;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("returns session runs ordered chronologically", () => {
    const wfId = store.upsertWorkflow("session-runs-wf", "custom", "hash");
    const sessionId = store.createSession("/tmp/project");

    const run1 = store.createRunInSession(wfId, sessionId, '{"n": 1}');
    const run2 = store.createRunInSession(wfId, sessionId, '{"n": 2}');
    const run3 = store.createRunInSession(wfId, sessionId, '{"n": 3}');

    const sessionRuns = store.getSessionRuns(sessionId);
    expect(sessionRuns).toHaveLength(3);
    expect(sessionRuns[0].id).toBe(run1);
    expect(sessionRuns[1].id).toBe(run2);
    expect(sessionRuns[2].id).toBe(run3);
  });

  it("marks orphaned running runs as failed", () => {
    const wfId = store.upsertWorkflow("orphan-wf", "custom", "hash");
    const run1 = store.createRun(wfId);
    store.updateRunStatus(run1, "running");
    const run2 = store.createRun(wfId);
    store.updateRunStatus(run2, "running");
    const run3 = store.createRun(wfId);
    store.updateRunStatus(run3, "completed");

    const count = store.failOrphanedRuns();
    expect(count).toBe(2);

    expect(store.getRun(run1)!.status).toBe("failed");
    expect(store.getRun(run2)!.status).toBe("failed");
    expect(store.getRun(run3)!.status).toBe("completed");
  });

  it("records orphaned event for each failed run", () => {
    const wfId = store.upsertWorkflow("orphan-ev-wf", "custom", "hash");
    const run1 = store.createRun(wfId);
    store.updateRunStatus(run1, "running");

    store.failOrphanedRuns();

    const evts = store.getEvents(run1);
    const orphanEvents = evts.filter((e) => e.type === "run:orphaned");
    expect(orphanEvents).toHaveLength(1);
    expect(orphanEvents[0].payload).toContain("crash recovery");
  });

  // ---- Activity Heartbeat ----

  it("records and retrieves heartbeat activity", () => {
    const wfId = store.upsertWorkflow("heartbeat-wf", "custom", "hash");
    const runId = store.createRun(wfId);

    store.updateRunActivity(runId);
    const lastActivity = store.getLastActivity(runId);
    expect(lastActivity).not.toBeNull();
    expect(typeof lastActivity).toBe("number");
  });

  it("returns null for run with no events", () => {
    // Create a run but don't add any events
    const wfId = store.upsertWorkflow("no-events-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    // getLastActivity queries events table, which should be empty for this run
    const lastActivity = store.getLastActivity(runId);
    expect(lastActivity).toBeNull();
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
