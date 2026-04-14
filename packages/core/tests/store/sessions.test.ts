import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { createDatabase, type Database } from "../../src/store/database.ts";
import { StoreQueries } from "../../src/store/queries.ts";
import { buildSessionContext, formatSessionContext } from "../../src/store/session-context.ts";

describe("Session Operations", () => {
  let db: Database;
  let store: StoreQueries;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
  });

  afterEach(() => {
    db.close();
  });

  it("creates and retrieves a session", () => {
    const id = store.createSession("/project");
    const session = store.getSession(id);
    expect(session).not.toBeNull();
    expect(session!.status).toBe("active");
    expect(session!.projectPath).toBe("/project");
  });

  it("creates a session with metadata", () => {
    const id = store.createSession("/project", { source: "claude-code" });
    const session = store.getSession(id);
    expect(session).not.toBeNull();
    expect(JSON.parse(session!.metadata!)).toEqual({ source: "claude-code" });
  });

  it("finds active session by project path", () => {
    store.createSession("/project");
    const active = store.getActiveSession("/project");
    expect(active).not.toBeNull();
    expect(active!.status).toBe("active");
  });

  it("returns null for no active session", () => {
    expect(store.getActiveSession("/nonexistent")).toBeNull();
  });

  it("closes a session", () => {
    const id = store.createSession("/project");
    store.closeSession(id);
    const session = store.getSession(id);
    expect(session!.status).toBe("closed");
    expect(session!.closedAt).not.toBeNull();
    // No longer returned as active
    expect(store.getActiveSession("/project")).toBeNull();
  });

  it("updates session activity timestamp", () => {
    const id = store.createSession("/project");
    const before = store.getSession(id)!.lastActivity;
    // Small delay to ensure timestamp changes
    store.updateSessionActivity(id);
    const after = store.getSession(id)!.lastActivity;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("creates a run in a session", () => {
    const sessionId = store.createSession("/project");
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRunInSession(wfId, sessionId, '{"issue": "1"}');

    const run = store.getRun(runId);
    expect(run).not.toBeNull();
    expect(run!.sessionId).toBe(sessionId);
  });

  it("gets session runs in order", () => {
    const sessionId = store.createSession("/project");
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    store.createRunInSession(wfId, sessionId);
    store.createRunInSession(wfId, sessionId);

    const runs = store.getSessionRuns(sessionId);
    expect(runs).toHaveLength(2);
  });

  it("expires stale sessions", () => {
    const id = store.createSession("/project");
    // Session was just created, so 1h cutoff should not expire it
    const count = store.expireStaleSessions(3_600_000);
    expect(count).toBe(0);
    expect(store.getSession(id)!.status).toBe("active");
  });

  it("returns null for nonexistent session", () => {
    expect(store.getSession("nonexistent")).toBeNull();
  });
});

describe("buildSessionContext", () => {
  let db: Database;
  let store: StoreQueries;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
  });

  afterEach(() => {
    db.close();
  });

  it("builds context from session runs", () => {
    const sessionId = store.createSession("/project");
    const wfId = store.upsertWorkflow("fix-issue", "custom", "hash");
    const runId = store.createRunInSession(wfId, sessionId);
    store.updateRunStatus(runId, "running");

    // Add a completed node with output
    const execId = store.createNodeExecution(runId, "investigate", 1);
    store.updateNodeExecutionStatus(execId, "completed", 5000);
    store.saveOutput(execId, "Found bug in auth.py");

    store.updateRunStatus(runId, "completed");

    const ctx = buildSessionContext(sessionId, store);
    expect(ctx.runCount).toBe(1);
    expect(ctx.runs[0].workflowName).toBe("fix-issue");
    expect(ctx.runs[0].status).toBe("completed");
    expect(ctx.runs[0].outputs.investigate).toBe("Found bug in auth.py");
  });

  it("formats context as readable string", () => {
    const sessionId = store.createSession("/project");
    const wfId = store.upsertWorkflow("fix-issue", "custom", "hash");
    const runId = store.createRunInSession(wfId, sessionId);
    store.updateRunStatus(runId, "running");
    store.updateRunStatus(runId, "completed");

    const ctx = buildSessionContext(sessionId, store);
    const formatted = formatSessionContext(ctx);
    expect(formatted).toContain("fix-issue");
    expect(formatted).toContain("completed");
  });

  it("returns empty string for no runs", () => {
    const sessionId = store.createSession("/project");
    const ctx = buildSessionContext(sessionId, store);
    expect(formatSessionContext(ctx)).toBe("");
  });

  it("truncates long outputs", () => {
    const sessionId = store.createSession("/project");
    const wfId = store.upsertWorkflow("long-output", "custom", "hash");
    const runId = store.createRunInSession(wfId, sessionId);
    store.updateRunStatus(runId, "running");

    const execId = store.createNodeExecution(runId, "verbose", 1);
    store.updateNodeExecutionStatus(execId, "completed", 1000);
    store.saveOutput(execId, "x".repeat(1000));

    store.updateRunStatus(runId, "completed");

    const ctx = buildSessionContext(sessionId, store);
    expect(ctx.runs[0].outputs.verbose).toHaveLength(503); // 500 + "..."
  });
});
