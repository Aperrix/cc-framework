import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { commandLogs } from "../../src/commands/logs.ts";
import { createDatabase, StoreQueries, type Database } from "@cc-framework/core";

describe("commandLogs", () => {
  let db: Database;
  let store: StoreQueries;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
  });

  afterEach(() => {
    db.close();
  });

  it("shows event timeline for a run", async () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");
    store.recordEvent(runId, "step1", "node:start");
    store.recordEvent(runId, "step1", "node:complete");
    store.updateRunStatus(runId, "completed");
    const result = await commandLogs(runId, store);
    expect(result).toContain("node:start");
    expect(result).toContain("node:complete");
  });

  it("shows no events message", async () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    const result = await commandLogs(runId, store);
    expect(result).toContain("No events");
  });

  it("throws for missing run", async () => {
    await expect(commandLogs("nonexistent", store)).rejects.toThrow(/not found/);
  });
});
