import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { createHandlers } from "../src/tools.ts";
import { createDatabase, StoreQueries, type Database } from "@cc-framework/core";
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
    store.updateRunStatus(runId, "paused");
    const result = await handlers.ccf_approve({ runId, nodeId: "gate" });
    expect(result.content[0].text).toContain("Approved");
  });

  it("ccf_reject rejects a paused run", async () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");
    store.updateRunStatus(runId, "paused");
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
});
