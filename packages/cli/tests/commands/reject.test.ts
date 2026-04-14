import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { commandReject } from "../../src/commands/reject.ts";
import { createDatabase, StoreQueries, type Database } from "@cc-framework/workflows";

describe("commandReject", () => {
  let db: Database;
  let store: StoreQueries;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
  });

  afterEach(() => {
    db.close();
  });

  it("rejects a paused run with reason", async () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");
    store.pauseRun(runId, {
      nodeId: "review-gate",
      message: "Please review",
      captureResponse: false,
      rejectionCount: 0,
    });
    const result = await commandReject(runId, "review-gate", "needs more tests", store);
    expect(result).toContain("Rejected");
    expect(result).toContain("needs more tests");
  });

  it("rejects without reason", async () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");
    store.pauseRun(runId, {
      nodeId: "gate",
      message: "Approval needed",
      captureResponse: false,
      rejectionCount: 0,
    });
    const result = await commandReject(runId, "gate", undefined, store);
    expect(result).toContain("Rejected");
  });

  it("throws for non-paused run", async () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");
    await expect(commandReject(runId, "gate", undefined, store)).rejects.toThrow(/Cannot reject/);
  });
});
