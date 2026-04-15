import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import {
  approveWorkflow,
  rejectWorkflow,
  abandonWorkflow,
  getWorkflowStatus,
  resumeWorkflow,
  runWorkflow,
} from "../../src/operations/workflow-operations.ts";
import { createDatabase, StoreQueries, type Database } from "@cc-framework/workflows";

describe("workflow-operations", () => {
  let db: Database;
  let store: StoreQueries;
  let sessionId: string;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
    sessionId = store.createSession("/tmp/test");
  });

  afterEach(() => {
    db.close();
  });

  function makePausedRun(): { runId: string; wfId: string } {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");
    store.pauseRun(runId, {
      nodeId: "gate",
      message: "Please approve",
      captureResponse: false,
      rejectionCount: 0,
    });
    return { runId, wfId };
  }

  function makeRunningRun(): { runId: string; wfId: string } {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");
    return { runId, wfId };
  }

  // ---- approveWorkflow ----

  describe("approveWorkflow", () => {
    it("approves a paused run with valid approval context", () => {
      const { runId } = makePausedRun();
      const result = approveWorkflow(runId, "gate", store);
      expect(result.runId).toBe(runId);
      expect(result.workflowName).toBe("test-wf");
      expect(result.resumed).toBe(true);
    });

    it("throws for non-paused run", () => {
      const { runId } = makeRunningRun();
      expect(() => approveWorkflow(runId, "gate", store)).toThrow(/Cannot approve/);
    });

    it("throws for missing run", () => {
      expect(() => approveWorkflow("nonexistent", "gate", store)).toThrow(/not found/);
    });

    it("throws for paused run without approval context", () => {
      const wfId = store.upsertWorkflow("test-wf2", "custom", "hash2");
      const runId = store.createRun(wfId);
      store.updateRunStatus(runId, "running");
      store.updateRunStatus(runId, "paused"); // No approval context
      expect(() => approveWorkflow(runId, "gate", store)).toThrow(/missing approval context/);
    });
  });

  // ---- rejectWorkflow ----

  describe("rejectWorkflow", () => {
    it("rejects a paused run with reason", () => {
      const { runId } = makePausedRun();
      const result = rejectWorkflow(runId, "gate", store, "needs more tests");
      expect(result.runId).toBe(runId);
      expect(result.reason).toBe("needs more tests");
    });

    it("uses default reason when none provided", () => {
      const { runId } = makePausedRun();
      const result = rejectWorkflow(runId, "gate", store);
      expect(result.reason).toBe("Rejected");
    });

    it("throws for non-paused run", () => {
      const { runId } = makeRunningRun();
      expect(() => rejectWorkflow(runId, "gate", store)).toThrow(/Cannot reject/);
    });

    it("throws for missing run", () => {
      expect(() => rejectWorkflow("nonexistent", "gate", store)).toThrow(/not found/);
    });
  });

  // ---- abandonWorkflow ----

  describe("abandonWorkflow", () => {
    it("cancels a running run", () => {
      const { runId } = makeRunningRun();
      const run = abandonWorkflow(runId, store);
      expect(run.id).toBe(runId);
      // Verify status changed
      const updated = store.getRun(runId);
      expect(updated?.status).toBe("cancelled");
    });

    it("cancels a paused run", () => {
      const { runId } = makePausedRun();
      const run = abandonWorkflow(runId, store);
      expect(run.id).toBe(runId);
      const updated = store.getRun(runId);
      expect(updated?.status).toBe("cancelled");
    });

    it("throws for terminal run", () => {
      const { runId } = makeRunningRun();
      store.updateRunStatus(runId, "completed");
      expect(() => abandonWorkflow(runId, store)).toThrow(/already terminal/);
    });

    it("throws for missing run", () => {
      expect(() => abandonWorkflow("nonexistent", store)).toThrow(/not found/);
    });
  });

  // ---- getWorkflowStatus ----

  describe("getWorkflowStatus", () => {
    it("returns empty runs for fresh session", () => {
      const result = getWorkflowStatus(store, sessionId);
      expect(result.runs).toHaveLength(0);
    });

    it("returns runs in session", () => {
      const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
      store.createRunInSession(wfId, sessionId);
      store.createRunInSession(wfId, sessionId);
      const result = getWorkflowStatus(store, sessionId);
      expect(result.runs).toHaveLength(2);
    });
  });

  // ---- resumeWorkflow ----

  describe("resumeWorkflow", () => {
    const fakeConfig = {
      model: "sonnet",
      effort: "high" as const,
      isolation: { strategy: "branch" as const, branch_prefix: "ccf/" },
      paths: {
        embeddedWorkflows: "/tmp/embedded",
        globalHome: "/tmp/global",
        globalWorkflows: "/tmp/global/workflows",
        database: "/tmp/db",
        projectRoot: "/tmp/project",
        projectConfig: "/tmp/project/.cc-framework",
        projectWorkflows: "/tmp/project/.cc-framework/workflows",
        projectPrompts: "/tmp/project/.cc-framework/prompts",
        projectScripts: "/tmp/project/.cc-framework/scripts",
        docsDir: "/tmp/project/.cc-framework/docs",
      },
    };

    it("throws for non-existent run", async () => {
      await expect(resumeWorkflow("nonexistent", fakeConfig, store, "/tmp")).rejects.toThrow(
        /not found/,
      );
    });

    it("throws for run not in resumable status", async () => {
      const { runId } = makeRunningRun();
      await expect(resumeWorkflow(runId, fakeConfig, store, "/tmp")).rejects.toThrow(
        /Cannot resume/,
      );
    });

    it("throws for completed (terminal) run", async () => {
      const { runId } = makeRunningRun();
      store.updateRunStatus(runId, "completed");
      await expect(resumeWorkflow(runId, fakeConfig, store, "/tmp")).rejects.toThrow(
        /Cannot resume/,
      );
    });

    it("throws when workflow file no longer exists on disk", async () => {
      const { runId } = makePausedRun();
      // findWorkflow will scan real disk and not find "test-wf", so it returns null
      await expect(resumeWorkflow(runId, fakeConfig, store, "/tmp")).rejects.toThrow(
        /no longer exists/,
      );
    });
  });

  // ---- runWorkflow ----

  describe("runWorkflow", () => {
    const fakeConfig = {
      model: "sonnet",
      effort: "high" as const,
      isolation: { strategy: "branch" as const, branch_prefix: "ccf/" },
      paths: {
        embeddedWorkflows: "/tmp/nonexistent-embedded",
        globalHome: "/tmp/global",
        globalWorkflows: "/tmp/global/workflows",
        database: "/tmp/db",
        projectRoot: "/tmp/project",
        projectConfig: "/tmp/project/.cc-framework",
        projectWorkflows: "/tmp/project/.cc-framework/workflows",
        projectPrompts: "/tmp/project/.cc-framework/prompts",
        projectScripts: "/tmp/project/.cc-framework/scripts",
        docsDir: "/tmp/project/.cc-framework/docs",
      },
    };

    it("throws when workflow not found", async () => {
      await expect(
        runWorkflow("nonexistent-wf", undefined, fakeConfig, store, sessionId, "/tmp"),
      ).rejects.toThrow(/not found/);
    });
  });
});
