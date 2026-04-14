import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { discoverScripts } from "../../src/discovery/scripts.ts";
import type { WorkflowConfig } from "../../src/deps.ts";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function makeConfig(projectRoot: string): WorkflowConfig {
  return {
    model: "sonnet",
    effort: "high",
    isolation: { strategy: "branch", branch_prefix: "ccf/" },
    paths: {
      embeddedWorkflows: "",
      globalWorkflows: "",
      database: "",
      projectRoot,
      projectWorkflows: join(projectRoot, ".cc-framework", "workflows"),
      projectPrompts: join(projectRoot, ".cc-framework", "prompts"),
      projectScripts: join(projectRoot, ".cc-framework", "scripts"),
      docsDir: join(projectRoot, "docs"),
    },
  };
}

describe("discoverScripts", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ccf-scripts-test-"));
    await mkdir(join(tempDir, ".cc-framework", "scripts"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("discovers scripts with correct runtime detection", async () => {
    await writeFile(join(tempDir, ".cc-framework", "scripts", "setup.sh"), "#!/bin/bash");
    await writeFile(join(tempDir, ".cc-framework", "scripts", "transform.ts"), "console.log('ok')");
    await writeFile(join(tempDir, ".cc-framework", "scripts", "analyze.py"), "print('ok')");

    const config = makeConfig(tempDir);
    const scripts = await discoverScripts(config);

    expect(scripts).toHaveLength(3);
    expect(scripts.find((s) => s.name === "setup")?.runtime).toBe("bash");
    expect(scripts.find((s) => s.name === "transform")?.runtime).toBe("bun");
    expect(scripts.find((s) => s.name === "analyze")?.runtime).toBe("uv");
  });
});
