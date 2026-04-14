import { describe, expect, it, afterEach } from "vite-plus/test";
import { parseWorkflow } from "../src/parser/parse-workflow.ts";
import { createDatabase } from "../src/store/database.ts";
import { StoreQueries } from "../src/store/queries.ts";
import { WorkflowEventBus } from "../src/events/event-bus.ts";
import { WorkflowExecutor } from "../src/executor/executor.ts";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Database } from "../src/store/database.ts";
import type { ResolvedConfig } from "@cc-framework/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

function makeConfig(projectRoot: string): ResolvedConfig {
  return {
    model: "sonnet",
    effort: "high",
    isolation: { strategy: "branch", branch_prefix: "ccf/" },
    paths: {
      embeddedWorkflows: "",
      globalHome: "",
      globalWorkflows: "",
      database: "",
      projectRoot,
      projectConfig: join(projectRoot, ".cc-framework"),
      projectWorkflows: join(projectRoot, ".cc-framework", "workflows"),
      projectPrompts: join(projectRoot, "prompts"),
      projectScripts: join(projectRoot, ".cc-framework", "scripts"),
      docsDir: join(projectRoot, "docs"),
    },
  };
}

describe("Integration: YAML → Parse → Execute", () => {
  let db: Database;

  afterEach(() => {
    db?.close();
  });

  it("parses and executes a sequential workflow end-to-end", async () => {
    const workflow = await parseWorkflow(
      join(fixturesDir, "e2e-sequential.yaml"),
      makeConfig(fixturesDir),
    );

    db = createDatabase(":memory:");
    const store = new StoreQueries(db);
    const eventBus = new WorkflowEventBus();

    const events: string[] = [];
    eventBus.on("node:start", (e) => events.push(`start:${e.nodeId}`));
    eventBus.on("node:complete", (e) => events.push(`complete:${e.nodeId}`));
    eventBus.on("run:done", (e) => events.push(`done:${e.status}`));

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp");

    expect(result.status).toBe("completed");
    expect(events).toContain("start:greet");
    expect(events).toContain("complete:greet");
    expect(events).toContain("done:completed");
  });

  it("parses and executes a parallel workflow", async () => {
    const workflow = await parseWorkflow(
      join(fixturesDir, "e2e-parallel.yaml"),
      makeConfig(fixturesDir),
    );

    db = createDatabase(":memory:");
    const store = new StoreQueries(db);
    const eventBus = new WorkflowEventBus();

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp");

    expect(result.status).toBe("completed");
    const outputs = store.getNodeOutputs(result.runId);
    expect(outputs.setup).toBeDefined();
    expect(outputs["worker-a"]).toBeDefined();
    expect(outputs["worker-b"]).toBeDefined();
    expect(outputs.aggregate).toBeDefined();
  });
});
