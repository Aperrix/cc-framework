import { describe, expect, it, afterEach } from "vite-plus/test";
import { parseWorkflow } from "../src/parser/parse-workflow.ts";
import { createDatabase } from "../src/store/database.ts";
import { StoreQueries } from "../src/store/queries.ts";
import { WorkflowEventBus } from "../src/events/event-bus.ts";
import { WorkflowExecutor } from "../src/executor/executor.ts";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Database } from "../src/store/database.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

describe("Integration: YAML → Parse → Execute", () => {
  let db: Database;

  afterEach(() => {
    db?.close();
  });

  it("parses and executes a minimal workflow end-to-end", async () => {
    const workflow = await parseWorkflow(join(fixturesDir, "minimal.yaml"), fixturesDir);

    db = createDatabase(":memory:");
    const store = new StoreQueries(db);
    const eventBus = new WorkflowEventBus();

    const events: string[] = [];
    eventBus.on("node:start", (e) => events.push(`start:${e.nodeId}`));
    eventBus.on("node:complete", (e) => events.push(`complete:${e.nodeId}`));
    eventBus.on("run:done", (e) => events.push(`done:${e.status}`));

    // Override the prompt node with a script node for testing (no API key needed)
    workflow.nodes[0] = {
      ...workflow.nodes[0],
      prompt: undefined,
      script: "echo 'Hello from integration test'",
    } as any;

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp");

    expect(result.status).toBe("completed");
    expect(events).toContain("start:greet");
    expect(events).toContain("complete:greet");
    expect(events).toContain("done:completed");
  });

  it("parses and executes a parallel workflow", async () => {
    const workflow = await parseWorkflow(join(fixturesDir, "parallel.yaml"), fixturesDir);

    db = createDatabase(":memory:");
    const store = new StoreQueries(db);
    const eventBus = new WorkflowEventBus();

    // Replace AI nodes with script nodes for testing
    for (const node of workflow.nodes) {
      (node as any).prompt = undefined;
      (node as any).script = `echo '${node.id} done'`;
    }

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp");

    expect(result.status).toBe("completed");
    const outputs = store.getNodeOutputs(result.runId);
    expect(outputs.scope).toBeDefined();
    expect(outputs["review-a"]).toBeDefined();
    expect(outputs["review-b"]).toBeDefined();
    expect(outputs.synthesize).toBeDefined();
  });
});
