import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  handleMessage,
  handleSessionTransition,
  resolveWorkflowFuzzy,
  type OrchestratorContext,
} from "../../src/orchestrator/orchestrator.ts";
import { createDatabase, StoreQueries, type Database } from "@cc-framework/workflows";
import type { ResolvedConfig } from "../../src/config/types.ts";

function makeConfig(cwd: string): ResolvedConfig {
  return {
    model: "sonnet",
    effort: "high",
    isolation: { strategy: "branch", branch_prefix: "ccf/" },
    paths: {
      embeddedWorkflows: "",
      globalHome: "",
      globalWorkflows: "",
      database: ":memory:",
      projectRoot: cwd,
      projectConfig: join(cwd, ".cc-framework"),
      projectWorkflows: join(cwd, ".cc-framework", "workflows"),
      projectPrompts: join(cwd, ".cc-framework", "prompts"),
      projectScripts: join(cwd, ".cc-framework", "scripts"),
      docsDir: join(cwd, "docs"),
    },
  };
}

describe("orchestrator", () => {
  let tempDir: string;
  let db: Database;
  let store: StoreQueries;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ccf-orch-test-"));
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
  });

  afterEach(async () => {
    db.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  function makeCtx(overrides?: Partial<OrchestratorContext>): OrchestratorContext {
    return {
      config: makeConfig(tempDir),
      store,
      sessionId: store.createSession(tempDir),
      cwd: tempDir,
      ...overrides,
    };
  }

  async function writeWorkflow(name: string, content: string): Promise<void> {
    const dir = join(tempDir, ".cc-framework", "workflows");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${name}.yaml`), content);
  }

  // ---- resolveWorkflowFuzzy ----

  describe("resolveWorkflowFuzzy", () => {
    it("matches exact name", () => {
      const discovered = [{ name: "fix-issue", path: "/a", source: "project" as const }];
      const result = resolveWorkflowFuzzy("fix-issue", discovered);
      expect(result).toEqual({ name: "fix-issue", tier: "exact" });
    });

    it("matches case-insensitively", () => {
      const discovered = [{ name: "Fix-Issue", path: "/a", source: "project" as const }];
      const result = resolveWorkflowFuzzy("fix-issue", discovered);
      expect(result).toEqual({ name: "Fix-Issue", tier: "case_insensitive" });
    });

    it("matches by suffix", () => {
      const discovered = [{ name: "fix-issue", path: "/a", source: "project" as const }];
      const result = resolveWorkflowFuzzy("issue", discovered);
      expect(result).toEqual({ name: "fix-issue", tier: "suffix" });
    });

    it("returns null for no match", () => {
      const discovered = [{ name: "fix-issue", path: "/a", source: "project" as const }];
      expect(resolveWorkflowFuzzy("deploy", discovered)).toBeNull();
    });
  });

  // ---- handleSessionTransition ----

  describe("handleSessionTransition", () => {
    it("creates new session for plan-to-execute", () => {
      const oldSession = store.createSession(tempDir);
      const newSession = handleSessionTransition("plan-to-execute", store, tempDir);
      expect(newSession).not.toBe(oldSession);
    });

    it("returns existing session for first-message", () => {
      const sessionId = store.createSession(tempDir);
      const result = handleSessionTransition("first-message", store, tempDir);
      expect(result).toBe(sessionId);
    });
  });

  // ---- handleMessage ----

  describe("handleMessage", () => {
    it("returns assist when no workflows exist", async () => {
      const result = await handleMessage("fix something", makeCtx());
      expect(result.type).toBe("assist");
      if (result.type === "assist") {
        expect(result.message).toContain("No workflows available");
      }
    });

    it("dispatches workflow by exact name match", async () => {
      await writeWorkflow(
        "echo-test",
        "name: echo-test\nnodes:\n  - id: step1\n    script: echo hello\n    runtime: bash",
      );
      // Need to init git for isolation
      const { execSync } = await import("node:child_process");
      execSync("git init", { cwd: tempDir, stdio: "ignore" });
      execSync("git add -A && git commit -m init --allow-empty", { cwd: tempDir, stdio: "ignore" });

      const result = await handleMessage("echo-test", makeCtx());
      expect(result.type).toBe("workflow_started");
      if (result.type === "workflow_started") {
        expect(result.workflowName).toBe("echo-test");
      }
    });

    it("dispatches with fuzzy suffix match", async () => {
      await writeWorkflow(
        "fix-issue",
        "name: fix-issue\nnodes:\n  - id: step1\n    script: echo fix\n    runtime: bash",
      );
      const { execSync } = await import("node:child_process");
      execSync("git init", { cwd: tempDir, stdio: "ignore" });
      execSync("git add -A && git commit -m init --allow-empty", { cwd: tempDir, stdio: "ignore" });

      const result = await handleMessage("issue some args", makeCtx());
      expect(result.type).toBe("workflow_started");
      if (result.type === "workflow_started") {
        expect(result.workflowName).toBe("fix-issue");
      }
    });

    it("returns assist when no workflow matches", async () => {
      await writeWorkflow(
        "review",
        "name: review\nnodes:\n  - id: step1\n    script: echo review\n    runtime: bash",
      );
      const result = await handleMessage("deploy production", makeCtx());
      expect(result.type).toBe("assist");
      if (result.type === "assist") {
        expect(result.message).toContain("review");
      }
    });
  });
});
