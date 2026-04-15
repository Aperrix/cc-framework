/** E2E: workflow with worktree isolation — setup, execute, cleanup. */

import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { setupIsolation, cleanupIsolation, listWorktrees } from "../src/isolation/isolation.ts";
import { parseWorkflow } from "../src/parser/parse-workflow.ts";
import { createDatabase } from "../src/store/database.ts";
import { StoreQueries } from "../src/store/queries.ts";
import { WorkflowEventBus } from "../src/events/event-bus.ts";
import { WorkflowExecutor } from "../src/executor/executor.ts";
import type { Database } from "../src/store/database.ts";
import type { WorkflowConfig } from "../src/deps.ts";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

describe("E2E: Isolation worktree", () => {
  let repoDir: string;
  let db: Database;
  let store: StoreQueries;

  let baseDir: string;

  beforeEach(async () => {
    // Create a unique base directory so worktrees (../...) stay contained
    baseDir = await mkdtemp(join(tmpdir(), "ccf-iso-e2e-"));
    repoDir = join(baseDir, "repo");
    execSync(
      `mkdir -p "${repoDir}" && cd "${repoDir}" && git init && git commit --allow-empty -m init`,
    );
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
  });

  afterEach(async () => {
    db.close();
    await rm(baseDir, { recursive: true, force: true });
  });

  it("creates worktree, runs workflow inside it, then cleans up", async () => {
    // Setup isolation
    const env = await setupIsolation(
      { strategy: "worktree", branch_prefix: "ccf/" },
      "test-run",
      repoDir,
    );

    expect(env.strategy).toBe("worktree");
    expect(env.branchName).toBe("ccf/test-run");
    expect(env.workingDirectory).not.toBe(repoDir);

    // Verify worktree was created
    const worktrees = await listWorktrees(repoDir, "ccf/");
    expect(worktrees).toHaveLength(1);
    expect(worktrees[0].branch).toBe("ccf/test-run");

    // Run a simple workflow inside the worktree
    const config: WorkflowConfig = {
      model: "sonnet",
      effort: "high",
      isolation: { strategy: "worktree", branch_prefix: "ccf/" },
      paths: {
        embeddedWorkflows: "",
        globalWorkflows: "",
        database: ":memory:",
        projectRoot: env.workingDirectory,
        projectWorkflows: "",
        projectPrompts: "",
        projectScripts: "",
        docsDir: "",
      },
    };

    const workflow = await parseWorkflow(join(fixturesDir, "e2e-isolation.yaml"), config);

    const eventBus = new WorkflowEventBus();
    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, env.workingDirectory, undefined, config);

    expect(result.status).toBe("completed");

    // Verify the workflow ran in the worktree directory (resolve symlinks for comparison)
    const { realpathSync } = await import("node:fs");
    const outputs = store.getNodeOutputs(result.runId);
    const actualCwd = realpathSync(outputs.check?.output.trim() ?? "");
    const expectedCwd = realpathSync(env.workingDirectory);
    expect(actualCwd).toBe(expectedCwd);

    // Cleanup
    await cleanupIsolation(env);
    const remaining = await listWorktrees(repoDir, "ccf/");
    expect(remaining).toHaveLength(0);
  });

  it("creates branch isolation without worktree", async () => {
    const env = await setupIsolation(
      { strategy: "branch", branch_prefix: "ccf/" },
      "branch-run",
      repoDir,
    );

    expect(env.strategy).toBe("branch");
    expect(env.branchName).toBe("ccf/branch-run");
    expect(env.workingDirectory).toBe(repoDir);

    // Verify branch was created
    const branches = execSync("git branch --list ccf/*", { cwd: repoDir, encoding: "utf-8" });
    expect(branches).toContain("ccf/branch-run");

    // Cleanup (switch back to main first)
    execSync("git checkout main 2>/dev/null || git checkout master", { cwd: repoDir });
    execSync("git branch -D ccf/branch-run", { cwd: repoDir });
  });
});
