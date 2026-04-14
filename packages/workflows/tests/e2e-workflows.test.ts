/**
 * E2E tests for default workflow DAG structures.
 *
 * These tests execute the workflow DAG patterns (conditions, parallel, trigger_rules)
 * using script stubs instead of LLM prompts to verify the orchestration logic.
 */

import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { parseWorkflow } from "../src/parser/parse-workflow.ts";
import { createDatabase } from "../src/store/database.ts";
import { StoreQueries } from "../src/store/queries.ts";
import { WorkflowEventBus } from "../src/events/event-bus.ts";
import { WorkflowExecutor } from "../src/executor/executor.ts";
import type { Database } from "../src/store/database.ts";
import type { ResolvedConfig } from "@cc-framework/core";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

function makeConfig(): ResolvedConfig {
  return {
    model: "sonnet",
    effort: "high",
    isolation: { strategy: "branch", branch_prefix: "ccf/" },
    paths: {
      embeddedWorkflows: "",
      globalHome: "",
      globalWorkflows: "",
      database: ":memory:",
      projectRoot: fixturesDir,
      projectConfig: join(fixturesDir, ".cc-framework"),
      projectWorkflows: join(fixturesDir, ".cc-framework", "workflows"),
      projectPrompts: join(fixturesDir, "prompts"),
      projectScripts: join(fixturesDir, ".cc-framework", "scripts"),
      docsDir: join(fixturesDir, "docs"),
    },
  };
}

describe("E2E: fix-issue DAG pattern", () => {
  let db: Database;
  let store: StoreQueries;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
  });

  afterEach(() => {
    db.close();
  });

  it("routes bugs through investigate, skips plan", async () => {
    const config = makeConfig();
    const workflow = await parseWorkflow(join(fixturesDir, "e2e-fix-issue-bug.yaml"), config);
    const eventBus = new WorkflowEventBus();

    const skipped: string[] = [];
    eventBus.on("node:skipped", (e) => skipped.push(e.nodeId));

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp", undefined, config);

    expect(result.status).toBe("completed");

    const outputs = store.getNodeOutputs(result.runId);
    // classify → investigate (bug path)
    expect(outputs.classify.output).toContain("bug");
    expect(outputs.investigate).toBeDefined();
    // plan should be skipped
    expect(skipped).toContain("plan");
    // bridge should run via trigger_rule: one_success
    expect(outputs["bridge-artifacts"]).toBeDefined();
    // implement and validate should complete
    expect(outputs.implement).toBeDefined();
    expect(outputs.validate).toBeDefined();
  });

  it("routes features through plan, skips investigate", async () => {
    const config = makeConfig();
    const workflow = await parseWorkflow(join(fixturesDir, "e2e-fix-issue-feature.yaml"), config);
    const eventBus = new WorkflowEventBus();

    const skipped: string[] = [];
    eventBus.on("node:skipped", (e) => skipped.push(e.nodeId));

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp", undefined, config);

    expect(result.status).toBe("completed");

    const outputs = store.getNodeOutputs(result.runId);
    expect(outputs.classify.output).toContain("feature");
    expect(skipped).toContain("investigate");
    expect(outputs.plan).toBeDefined();
    expect(outputs["bridge-artifacts"]).toBeDefined();
  });
});

describe("E2E: review DAG pattern", () => {
  let db: Database;
  let store: StoreQueries;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
  });

  afterEach(() => {
    db.close();
  });

  it("runs 4 review agents in parallel then synthesizes", async () => {
    const config = makeConfig();
    const workflow = await parseWorkflow(join(fixturesDir, "e2e-review.yaml"), config);
    const eventBus = new WorkflowEventBus();

    const startTimes: Record<string, number> = {};
    eventBus.on("node:start", (e) => {
      startTimes[e.nodeId] = Date.now();
    });

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp", undefined, config);

    expect(result.status).toBe("completed");

    const outputs = store.getNodeOutputs(result.runId);
    // All 4 review agents + scope + synthesize = 6 nodes
    expect(Object.keys(outputs)).toHaveLength(6);

    // Synthesize should run after all review agents
    expect(startTimes.synthesize).toBeGreaterThan(startTimes["gather-scope"]);

    // All 4 agents should start in the same DAG layer (parallel)
    const agentStarts = [
      startTimes["code-review"],
      startTimes["error-handling"],
      startTimes["test-coverage"],
      startTimes["security-review"],
    ];
    const maxDiff = Math.max(...agentStarts) - Math.min(...agentStarts);
    // They should start within 200ms of each other (same layer)
    expect(maxDiff).toBeLessThan(200);
  });
});

describe("E2E: refactor DAG pattern", () => {
  let db: Database;
  let store: StoreQueries;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
  });

  afterEach(() => {
    db.close();
  });

  it("executes scan → analyze → plan → validate → verify pipeline", async () => {
    const config = makeConfig();
    const workflow = await parseWorkflow(join(fixturesDir, "e2e-refactor.yaml"), config);
    const eventBus = new WorkflowEventBus();

    const order: string[] = [];
    eventBus.on("node:complete", (e) => order.push(e.nodeId));

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp", undefined, config);

    expect(result.status).toBe("completed");

    // Verify strict sequential order
    expect(order).toEqual([
      "scan-scope",
      "analyze-impact",
      "plan-tasks",
      "validate",
      "verify-behavior",
    ]);
  });
});
