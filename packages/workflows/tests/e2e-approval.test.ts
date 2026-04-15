/** E2E: approval gate → pause → approve → resume → complete */

import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { parseWorkflow } from "../src/parser/parse-workflow.ts";
import { createDatabase } from "../src/store/database.ts";
import { StoreQueries } from "../src/store/queries.ts";
import { WorkflowEventBus } from "../src/events/event-bus.ts";
import { WorkflowExecutor } from "../src/executor/executor.ts";
import type { Database } from "../src/store/database.ts";
import type { WorkflowConfig } from "../src/deps.ts";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

function makeConfig(projectRoot: string): WorkflowConfig {
  return {
    model: "sonnet",
    effort: "high",
    isolation: { strategy: "branch", branch_prefix: "ccf/" },
    paths: {
      embeddedWorkflows: "",
      globalWorkflows: "",
      database: ":memory:",
      projectRoot,
      projectWorkflows: join(projectRoot, ".cc-framework", "workflows"),
      projectPrompts: join(projectRoot, "prompts"),
      projectScripts: join(projectRoot, ".cc-framework", "scripts"),
      docsDir: join(projectRoot, "docs"),
    },
  };
}

describe("E2E: Approval workflow", () => {
  let db: Database;
  let store: StoreQueries;
  let config: WorkflowConfig;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
    config = makeConfig(fixturesDir);
  });

  afterEach(() => {
    db.close();
  });

  it("pauses at approval gate, then resumes after approval", async () => {
    const workflow = await parseWorkflow(join(fixturesDir, "e2e-approval.yaml"), config);

    const eventBus = new WorkflowEventBus();
    const events: string[] = [];
    eventBus.on("node:start", (e) => events.push(`start:${e.nodeId}`));
    eventBus.on("node:complete", (e) => events.push(`complete:${e.nodeId}`));
    eventBus.on("approval:request", (e) => events.push(`approval:${e.nodeId}`));

    const executor = new WorkflowExecutor(store, eventBus);

    // Phase 1: Run — should pause at approval gate
    const r1 = await executor.run(workflow, "/tmp", undefined, config);
    expect(r1.status).toBe("paused");

    // Verify: prepare completed, approval emitted, finalize not started
    expect(events).toContain("start:prepare");
    expect(events).toContain("complete:prepare");
    expect(events).toContain("approval:review-gate");
    expect(events).not.toContain("start:finalize");

    // Phase 2: Approve — mark node as completed and resume run status
    store.completeNodeByNodeId(r1.runId, "review-gate");
    store.resumeRun(r1.runId);

    // Phase 3: Resume — should skip approval and run finalize
    const executor2 = new WorkflowExecutor(store, new WorkflowEventBus());
    const r2 = await executor2.resume(workflow, r1.runId, "/tmp", undefined, config);
    expect(r2.status).toBe("completed");

    // Verify: all nodes completed
    const completed = store.getCompletedNodeIds(r1.runId);
    expect(completed.has("prepare")).toBe(true);
    expect(completed.has("review-gate")).toBe(true);
    expect(completed.has("finalize")).toBe(true);

    // Verify finalize output
    const outputs = store.getNodeOutputs(r1.runId);
    expect(outputs.finalize?.output).toContain("approved and finalized");
  });

  it("stays paused if not approved before resume attempt", async () => {
    const workflow = await parseWorkflow(join(fixturesDir, "e2e-approval.yaml"), config);
    const executor = new WorkflowExecutor(store, new WorkflowEventBus());

    const r1 = await executor.run(workflow, "/tmp", undefined, config);
    expect(r1.status).toBe("paused");

    // Resume WITHOUT approving — should pause again at the same gate
    store.resumeRun(r1.runId);
    const executor2 = new WorkflowExecutor(store, new WorkflowEventBus());
    const r2 = await executor2.resume(workflow, r1.runId, "/tmp", undefined, config);
    expect(r2.status).toBe("paused");
  });
});
