/** End-to-end tests — full pipeline from YAML to DB verification. */

import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { parseWorkflow } from "../src/parser/parse-workflow.ts";
import { createDatabase } from "../src/store/database.ts";
import { StoreQueries } from "../src/store/queries.ts";
import { WorkflowEventBus } from "../src/events/event-bus.ts";
import { WorkflowExecutor } from "../src/executor/executor.ts";
import type { Database } from "../src/store/database.ts";
import type { ResolvedConfig } from "../src/config/types.ts";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { unlinkSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

function makeConfig(projectRoot: string): ResolvedConfig {
  return {
    model: "sonnet",
    effort: "high",
    isolation: { strategy: "branch", branch_prefix: "ccf/" },
    paths: {
      globalHome: "",
      globalWorkflows: "",
      database: ":memory:",
      projectRoot,
      projectConfig: join(projectRoot, ".cc-framework"),
      projectWorkflows: join(projectRoot, ".cc-framework", "workflows"),
      projectPrompts: join(projectRoot, "prompts"),
      projectScripts: join(projectRoot, ".cc-framework", "scripts"),
      docsDir: join(projectRoot, "docs"),
    },
  };
}

function cleanRetryStateFile(): void {
  try {
    unlinkSync("/tmp/ccf-e2e-retry");
  } catch {
    // Ignore if file doesn't exist
  }
}

describe("E2E: Sequential workflow", () => {
  let db: Database;
  let store: StoreQueries;
  let config: ResolvedConfig;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
    config = makeConfig(fixturesDir);
  });

  afterEach(() => {
    db.close();
  });

  it("executes 3 sequential nodes with variable substitution", async () => {
    const workflow = await parseWorkflow(join(fixturesDir, "e2e-sequential.yaml"), config);
    const eventBus = new WorkflowEventBus();
    const events: string[] = [];
    eventBus.on("node:start", (e) => events.push(`start:${e.nodeId}`));
    eventBus.on("node:complete", (e) => events.push(`complete:${e.nodeId}`));

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp", undefined, config);

    // Verify run completed
    expect(result.status).toBe("completed");

    // Verify all 3 nodes executed in order
    expect(events.indexOf("start:greet")).toBeLessThan(events.indexOf("start:transform"));
    expect(events.indexOf("start:transform")).toBeLessThan(events.indexOf("start:verify"));

    // Verify outputs stored in DB
    const outputs = store.getNodeOutputs(result.runId);
    expect(outputs.greet.output.trim()).toBe("Hello World");
    expect(outputs.transform.output.trim()).toBe("TRANSFORMED");
    expect(outputs.verify.output.trim()).toBe("DONE");

    // Verify run record in DB
    const run = store.getRun(result.runId);
    expect(run).not.toBeNull();
    expect(run!.status).toBe("completed");
    expect(run!.finishedAt).not.toBeNull();

    // Verify events recorded in DB
    const dbEvents = store.getEvents(result.runId);
    expect(dbEvents.length).toBeGreaterThan(0);
    expect(dbEvents.some((e) => e.type === "node:complete")).toBe(true);
  });
});

describe("E2E: Parallel workflow", () => {
  let db: Database;
  let store: StoreQueries;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
  });

  afterEach(() => {
    db.close();
  });

  it("executes parallel nodes concurrently and aggregates", async () => {
    const config = makeConfig(fixturesDir);
    const workflow = await parseWorkflow(join(fixturesDir, "e2e-parallel.yaml"), config);
    const eventBus = new WorkflowEventBus();

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp", undefined, config);

    expect(result.status).toBe("completed");

    // All 5 nodes should have outputs
    const outputs = store.getNodeOutputs(result.runId);
    expect(Object.keys(outputs)).toHaveLength(5);
    expect(outputs.setup.output.trim()).toBe("setup-complete");
    expect(outputs["worker-a"].output.trim()).toBe("result-a");
    expect(outputs["worker-b"].output.trim()).toBe("result-b");
    expect(outputs["worker-c"].output.trim()).toBe("result-c");
    expect(outputs.aggregate.output.trim()).toBe("aggregated");
  });
});

describe("E2E: Conditional workflow", () => {
  let db: Database;
  let store: StoreQueries;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
  });

  afterEach(() => {
    db.close();
  });

  it("branches based on when condition — runs bug-fix, skips feature-impl", async () => {
    const config = makeConfig(fixturesDir);
    const workflow = await parseWorkflow(join(fixturesDir, "e2e-conditional.yaml"), config);
    const eventBus = new WorkflowEventBus();
    const skipped: string[] = [];
    eventBus.on("node:skipped", (e) => skipped.push(e.nodeId));

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp", undefined, config);

    expect(result.status).toBe("completed");

    // bug-fix should have run
    const outputs = store.getNodeOutputs(result.runId);
    expect(outputs["bug-fix"]).toBeDefined();
    expect(outputs["bug-fix"].output.trim()).toBe("fixing bug");

    // feature-impl should be skipped
    expect(skipped).toContain("feature-impl");
    expect(outputs["feature-impl"]).toBeUndefined();

    // report should run (trigger_rule: one_success — bug-fix succeeded)
    expect(outputs.report).toBeDefined();
  });
});

describe("E2E: Retry workflow", () => {
  let db: Database;
  let store: StoreQueries;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
    cleanRetryStateFile();
  });

  afterEach(() => {
    db.close();
    cleanRetryStateFile();
  });

  it("retries a failed node and succeeds on second attempt", async () => {
    const config = makeConfig(fixturesDir);
    const workflow = await parseWorkflow(join(fixturesDir, "e2e-retry.yaml"), config);
    const eventBus = new WorkflowEventBus();

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp", undefined, config);

    expect(result.status).toBe("completed");

    // Should have completed the flaky node
    const completedIds = store.getCompletedNodeIds(result.runId);
    expect(completedIds.has("flaky")).toBe(true);

    // Verify retry event was recorded in DB
    const dbEvents = store.getEvents(result.runId);
    expect(dbEvents.some((e) => e.type === "node:retry")).toBe(true);
  });
});

describe("E2E: Cancel workflow", () => {
  let db: Database;
  let store: StoreQueries;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
  });

  afterEach(() => {
    db.close();
  });

  it("cancels workflow when cancel node condition is met", async () => {
    const config = makeConfig(fixturesDir);
    const workflow = await parseWorkflow(join(fixturesDir, "e2e-cancel.yaml"), config);
    const eventBus = new WorkflowEventBus();

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp", undefined, config);

    expect(result.status).toBe("cancelled");

    // "continue" node should never have run
    const outputs = store.getNodeOutputs(result.runId);
    expect(outputs["continue"]).toBeUndefined();

    // Run should be marked cancelled in DB
    const run = store.getRun(result.runId);
    expect(run!.status).toBe("cancelled");
  });
});

describe("E2E: Session and metrics", () => {
  let db: Database;
  let store: StoreQueries;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
  });

  afterEach(() => {
    db.close();
  });

  it("tracks runs across a session and provides metrics", async () => {
    const config = makeConfig(fixturesDir);
    const sessionId = store.createSession("/tmp");

    // Run workflow 1
    const wf1 = await parseWorkflow(join(fixturesDir, "e2e-sequential.yaml"), config);
    const executor1 = new WorkflowExecutor(store, new WorkflowEventBus());
    const r1 = await executor1.run(wf1, "/tmp", undefined, config, sessionId);
    expect(r1.status).toBe("completed");

    // Run workflow 2 in same session
    const wf2 = await parseWorkflow(join(fixturesDir, "e2e-parallel.yaml"), config);
    const executor2 = new WorkflowExecutor(store, new WorkflowEventBus());
    const r2 = await executor2.run(wf2, "/tmp", undefined, config, sessionId);
    expect(r2.status).toBe("completed");

    // Verify session has both runs
    const sessionRuns = store.getSessionRuns(sessionId);
    expect(sessionRuns).toHaveLength(2);

    // Verify workflow metrics
    const stats = store.getWorkflowStats("e2e-sequential");
    expect(stats.totalRuns).toBe(1);
    expect(stats.completedRuns).toBe(1);
    expect(stats.successRate).toBe(1);
  });

  it("provides checkpoint/resume across failed runs", async () => {
    const config = makeConfig(fixturesDir);

    // Parse a sequential workflow and make the last node fail
    const workflow = await parseWorkflow(join(fixturesDir, "e2e-sequential.yaml"), config);
    workflow.nodes[2] = {
      ...workflow.nodes[2],
      script: "exit 1",
    } as any;

    const executor = new WorkflowExecutor(store, new WorkflowEventBus());
    const r1 = await executor.run(workflow, "/tmp", undefined, config);
    expect(r1.status).toBe("failed");

    // Verify first 2 nodes completed
    const completed = store.getCompletedNodeIds(r1.runId);
    expect(completed.has("greet")).toBe(true);
    expect(completed.has("transform")).toBe(true);
    expect(completed.has("verify")).toBe(false);

    // Fix the workflow and resume
    workflow.nodes[2] = {
      ...workflow.nodes[2],
      script: "echo 'finally done'",
    } as any;

    const r2 = await executor.resume(workflow, r1.runId, "/tmp", undefined, config);
    expect(r2.status).toBe("completed");

    // All 3 nodes now completed
    const allCompleted = store.getCompletedNodeIds(r1.runId);
    expect(allCompleted.has("greet")).toBe(true);
    expect(allCompleted.has("transform")).toBe(true);
    expect(allCompleted.has("verify")).toBe(true);
  });
});
