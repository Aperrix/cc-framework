import { describe, expect, it } from "vite-plus/test";
import { parseWorkflow } from "../../src/parser/parse-workflow.ts";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures");

describe("parseWorkflow", () => {
  it("parses a valid YAML file", async () => {
    const wf = await parseWorkflow(join(fixturesDir, "minimal.yaml"), fixturesDir);
    expect(wf.name).toBe("minimal-test");
    expect(wf.nodes).toHaveLength(1);
    expect(wf.nodes[0].id).toBe("greet");
    expect(wf.nodes[0].prompt).toBe("Say hello");
  });

  it("throws on invalid YAML content", async () => {
    await expect(parseWorkflow("not-a-real-file.yaml", fixturesDir)).rejects.toThrow();
  });
});
