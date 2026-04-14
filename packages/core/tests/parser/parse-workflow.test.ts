import { describe, expect, it } from "vite-plus/test";
import { parseWorkflow } from "../../src/parser/parse-workflow.ts";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import type { ResolvedConfig } from "../../src/config/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures");

function makeConfig(projectRoot: string): ResolvedConfig {
  return {
    model: "sonnet",
    effort: "high",
    isolation: { strategy: "branch", branch_prefix: "ccf/" },
    paths: {
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

describe("parseWorkflow", () => {
  it("parses a valid YAML file", async () => {
    const wf = await parseWorkflow(join(fixturesDir, "minimal.yaml"), makeConfig(fixturesDir));
    expect(wf.name).toBe("minimal-test");
    expect(wf.nodes).toHaveLength(1);
    expect(wf.nodes[0].id).toBe("greet");
    expect(wf.nodes[0].prompt).toBe("Say hello");
  });

  it("throws on invalid YAML content", async () => {
    await expect(parseWorkflow("not-a-real-file.yaml", makeConfig(fixturesDir))).rejects.toThrow();
  });

  it("throws on invalid $nodeId.output reference in when condition", async () => {
    const { writeFile, mkdtemp, rm } = await import("node:fs/promises");
    const tempDir = await mkdtemp(join(tmpdir(), "ccf-ref-test-"));
    const yamlPath = join(tempDir, "bad-ref.yaml");
    await writeFile(
      yamlPath,
      `
name: bad-ref
nodes:
  - id: step1
    script: "echo hello"
  - id: step2
    script: "echo world"
    depends_on: [step1]
    when: "$nonexistent.output == 'hello'"
`,
    );
    await expect(parseWorkflow(yamlPath, makeConfig(tempDir))).rejects.toThrow(/nonexistent/);
    await rm(tempDir, { recursive: true, force: true });
  });
});
