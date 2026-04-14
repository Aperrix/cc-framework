import { describe, expect, it } from "vite-plus/test";
import { parseWorkflow } from "../src/parser/parse-workflow.ts";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readdir } from "node:fs/promises";
import type { ResolvedConfig } from "@cc-framework/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultsDir = join(__dirname, "..", "src", "defaults");

function makeConfig(): ResolvedConfig {
  return {
    model: "sonnet",
    effort: "high",
    isolation: { strategy: "branch", branch_prefix: "ccf/" },
    paths: {
      embeddedWorkflows: "",
      globalHome: "",
      globalWorkflows: "",
      database: "",
      projectRoot: defaultsDir,
      projectConfig: join(defaultsDir, ".cc-framework"),
      projectWorkflows: join(defaultsDir, ".cc-framework", "workflows"),
      projectPrompts: join(defaultsDir, "prompts"),
      projectScripts: join(defaultsDir, ".cc-framework", "scripts"),
      docsDir: join(defaultsDir, "docs"),
    },
  };
}

function workflowPath(name: string): string {
  return join(defaultsDir, `${name}.yaml`);
}

const EXPECTED_WORKFLOWS = ["assist", "feature", "fix-issue", "refactor", "review", "test"];

describe("default workflows", () => {
  it("all 6 default workflow YAML files exist", async () => {
    const entries = await readdir(defaultsDir, { withFileTypes: true });
    const yamls = entries
      .filter((e) => e.isFile() && e.name.endsWith(".yaml"))
      .map((e) => e.name.replace(/\.yaml$/, ""))
      .sort();
    expect(yamls).toEqual(EXPECTED_WORKFLOWS);
  });

  for (const name of EXPECTED_WORKFLOWS) {
    it(`${name}.yaml parses and validates successfully`, async () => {
      const wf = await parseWorkflow(workflowPath(name), makeConfig());
      expect(wf.name).toBe(name);
      expect(wf.nodes.length).toBeGreaterThan(0);

      // Every node must have a unique ID
      const ids = wf.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  }

  it("fix-issue has conditional investigate/plan branches", async () => {
    const wf = await parseWorkflow(workflowPath("fix-issue"), makeConfig());
    const investigate = wf.nodes.find((n) => n.id === "investigate");
    const plan = wf.nodes.find((n) => n.id === "plan");
    expect(investigate?.when).toContain("bug");
    expect(plan?.when).toContain("bug");
  });

  it("review has parallel review agents", async () => {
    const wf = await parseWorkflow(workflowPath("review"), makeConfig());
    const reviewNodes = wf.nodes.filter((n) => n.depends_on.includes("gather-scope"));
    expect(reviewNodes.length).toBeGreaterThanOrEqual(4);
  });

  it("refactor has read-only analysis nodes", async () => {
    const wf = await parseWorkflow(workflowPath("refactor"), makeConfig());
    const analyzeImpact = wf.nodes.find((n) => n.id === "analyze-impact");
    expect(analyzeImpact?.denied_tools).toContain("Write");
    expect(analyzeImpact?.denied_tools).toContain("Edit");
  });

  it("feature has an implementation loop", async () => {
    const wf = await parseWorkflow(workflowPath("feature"), makeConfig());
    const implement = wf.nodes.find((n) => n.id === "implement");
    expect(implement?.loop).toBeDefined();
    expect(implement?.loop?.until).toBe("COMPLETE");
  });

  it("test has coverage scripts and generation loop", async () => {
    const wf = await parseWorkflow(workflowPath("test"), makeConfig());
    const baseline = wf.nodes.find((n) => n.id === "coverage-baseline");
    expect(baseline?.script).toBeDefined();
    const generate = wf.nodes.find((n) => n.id === "generate-tests");
    expect(generate?.loop).toBeDefined();
  });

  it("assist is interactive", async () => {
    const wf = await parseWorkflow(workflowPath("assist"), makeConfig());
    expect(wf.interactive).toBe(true);
    expect(wf.nodes).toHaveLength(1);
  });
});
