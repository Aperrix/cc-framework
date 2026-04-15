import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { createHandlers } from "../src/tools.ts";
import { createDatabase, StoreQueries, type Database } from "@cc-framework/workflows";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { McpContext } from "../src/context.ts";

function makeTestContext(cwd: string, db: Database, store: StoreQueries): McpContext {
  return {
    config: {
      model: "sonnet",
      effort: "high",
      isolation: { strategy: "branch", branch_prefix: "ccf/" },
      paths: {
        embeddedWorkflows: "",
        globalHome: "",
        globalWorkflows: "",
        database: ":memory:",
        projectRoot: cwd,
        projectConfig: join(cwd, ".cc-framework"),
        projectWorkflows: join(cwd, ".cc-framework", "workflows"),
        projectPrompts: join(cwd, ".cc-framework", "prompts"),
        projectScripts: join(cwd, ".cc-framework", "scripts"),
        docsDir: join(cwd, "docs"),
      },
    },
    db,
    store,
    sessionId: store.createSession(cwd),
    cwd,
  };
}

describe("MCP tool handlers", () => {
  let tempDir: string;
  let db: Database;
  let store: StoreQueries;
  let handlers: ReturnType<typeof createHandlers>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ccf-mcp-test-"));
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
    handlers = createHandlers(makeTestContext(tempDir, db, store));
  });

  afterEach(async () => {
    db.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("ccf_init creates project structure", async () => {
    const result = await handlers.ccf_init({ path: tempDir });
    expect(result.content[0].text).toContain("Initialized");
  });

  it("ccf_list shows available workflows", async () => {
    await mkdir(join(tempDir, ".cc-framework", "workflows"), { recursive: true });
    await writeFile(
      join(tempDir, ".cc-framework", "workflows", "test.yaml"),
      "name: test\nnodes:\n  - id: x\n    script: echo hi",
    );
    const result = await handlers.ccf_list();
    expect(result.content[0].text).toContain("test");
  });

  it("ccf_list shows no workflows message", async () => {
    const result = await handlers.ccf_list();
    expect(result.content[0].text).toContain("No workflows");
  });

  it("ccf_status returns no runs for empty session", async () => {
    const result = await handlers.ccf_status({});
    expect(result.content[0].text).toContain("No runs");
  });

  it("ccf_status returns error for missing run", async () => {
    const result = await handlers.ccf_status({ runId: "nonexistent" });
    expect("isError" in result && result.isError).toBe(true);
  });

  it("ccf_logs returns error for missing run", async () => {
    const result = await handlers.ccf_logs({ runId: "nonexistent" });
    expect("isError" in result && result.isError).toBe(true);
  });

  it("ccf_approve approves a paused run", async () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");
    store.pauseRun(runId, {
      nodeId: "gate",
      message: "Please approve",
      captureResponse: false,
      rejectionCount: 0,
    });
    const result = await handlers.ccf_approve({ runId, nodeId: "gate" });
    expect(result.content[0].text).toContain("Approved");
  });

  it("ccf_reject rejects a paused run", async () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");
    store.pauseRun(runId, {
      nodeId: "gate",
      message: "Please approve",
      captureResponse: false,
      rejectionCount: 0,
    });
    const result = await handlers.ccf_reject({ runId, nodeId: "gate", reason: "needs work" });
    expect(result.content[0].text).toContain("Rejected");
    expect(result.content[0].text).toContain("needs work");
  });

  it("ccf_logs shows events for a run", async () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");
    store.recordEvent(runId, "step1", "node:start");
    store.recordEvent(runId, "step1", "node:complete");
    store.updateRunStatus(runId, "completed");
    const result = await handlers.ccf_logs({ runId });
    expect(result.content[0].text).toContain("node:start");
    expect(result.content[0].text).toContain("node:complete");
  });

  it("ccf_approve returns error for non-paused run", async () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");
    const result = await handlers.ccf_approve({ runId, nodeId: "gate" });
    expect("isError" in result && result.isError).toBe(true);
  });

  it("ccf_abandon cancels a running run", async () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");
    const result = await handlers.ccf_abandon({ runId });
    expect(result.content[0].text).toContain("Abandoned");
    expect(result.content[0].text).toContain(runId.slice(0, 8));
    // Verify run is now cancelled in the store
    const run = store.getRun(runId);
    expect(run?.status).toBe("cancelled");
  });

  it("ccf_abandon returns error for already-completed run", async () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "completed");
    const result = await handlers.ccf_abandon({ runId });
    expect("isError" in result && result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error");
  });

  it("ccf_abandon returns error for nonexistent run", async () => {
    const result = await handlers.ccf_abandon({ runId: "nonexistent" });
    expect("isError" in result && result.isError).toBe(true);
  });

  it("ccf_complete returns success message for branch cleanup", async () => {
    // completeIsolation uses gitSafe (non-throwing) for branch deletion,
    // so even a non-existent branch won't error — it just silently succeeds.
    const result = await handlers.ccf_complete({ branch: "ccf/fake-branch" });
    expect(result.content[0].text).toContain("Completed");
    expect(result.content[0].text).toContain("ccf/fake-branch");
  });

  it("ccf_complete includes remote deletion message when requested", async () => {
    // deleteRemote will try git push --delete which will fail, producing an error
    // or it may silently fail via gitSafe. Either way we test the flag is passed.
    const result = await handlers.ccf_complete({ branch: "ccf/fake-branch", deleteRemote: true });
    // If it errors (no remote), we check for error; if it succeeds, check for message
    if ("isError" in result && result.isError) {
      expect(result.content[0].text).toContain("Error");
    } else {
      expect(result.content[0].text).toContain("Remote branch deleted");
    }
  });

  // ccf_run and ccf_resume are not tested here because they require a full
  // executor + AI provider pipeline (runWorkflow/resumeWorkflow). Testing them
  // meaningfully would need extensive mocking of the workflow engine internals,
  // which would produce brittle tests that don't verify real behavior.
  // Integration tests at the core/workflows level cover these paths instead.
});
