import { describe, expect, it } from "vite-plus/test";
import { parseWorkflow } from "../../src/parser/parse-workflow.ts";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
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
});
