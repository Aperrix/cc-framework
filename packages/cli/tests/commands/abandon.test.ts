import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { commandAbandon } from "../../src/commands/abandon.ts";
import { createDatabase, StoreQueries, type Database } from "@cc-framework/workflows";

describe("commandAbandon", () => {
  let db: Database;
  let store: StoreQueries;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
  });

  afterEach(() => {
    db.close();
  });

  it("abandons a running run and returns confirmation", async () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");

    const result = await commandAbandon(runId, store);
    expect(result).toContain("Abandoned");
  });

  it("throws for a completed (terminal) run", async () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "completed");

    await expect(commandAbandon(runId, store)).rejects.toThrow(/already terminal/);
  });

  it("throws for a missing run", async () => {
    await expect(commandAbandon("nonexistent", store)).rejects.toThrow(/not found/);
  });
});
