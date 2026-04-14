import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { commandStatus } from "../../src/commands/status.ts";
import { createDatabase, StoreQueries, type Database } from "@cc-framework/core";

describe("commandStatus", () => {
  let db: Database;
  let store: StoreQueries;
  let sessionId: string;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
    sessionId = store.createSession("/test");
  });

  afterEach(() => {
    db.close();
  });

  it("shows no runs message for empty session", async () => {
    const result = await commandStatus(undefined, store, sessionId);
    expect(result).toContain("No runs");
  });

  it("shows specific run status", async () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    const runId = store.createRunInSession(wfId, sessionId);
    store.updateRunStatus(runId, "completed");
    const result = await commandStatus(runId, store, sessionId);
    expect(result).toContain("completed");
  });

  it("throws for missing run", async () => {
    await expect(commandStatus("nonexistent", store, sessionId)).rejects.toThrow(/not found/);
  });

  it("lists session runs", async () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash");
    store.createRunInSession(wfId, sessionId);
    store.createRunInSession(wfId, sessionId);
    const result = await commandStatus(undefined, store, sessionId);
    expect(result).toContain("Run");
  });
});
