import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { commandApprove } from "../../src/commands/approve.ts";
import { createDatabase, StoreQueries, type Database } from "@cc-framework/workflows";

describe("commandApprove", () => {
  let db: Database;
  let store: StoreQueries;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
  });

  afterEach(() => {
    db.close();
  });

  it("approves a paused run", async () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");
    store.updateRunStatus(runId, "paused");
    const result = await commandApprove(runId, "review-gate", store);
    expect(result).toContain("Approved");
    expect(result).toContain("review-gate");
  });

  it("throws for non-paused run", async () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");
    await expect(commandApprove(runId, "gate", store)).rejects.toThrow(/not paused/);
  });

  it("throws for missing run", async () => {
    await expect(commandApprove("nonexistent", "gate", store)).rejects.toThrow(/not found/);
  });
});
