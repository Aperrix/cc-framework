import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { discoverScripts, findScript } from "../../src/discovery/scripts.ts";
import type { ResolvedConfig } from "../../src/config/types.ts";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
      projectPrompts: join(projectRoot, ".cc-framework", "prompts"),
      projectScripts: join(projectRoot, ".cc-framework", "scripts"),
      docsDir: join(projectRoot, "docs"),
    },
  };
}

describe("discoverScripts", () => {
  let tempDir: string;
  let embeddedDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ccf-scripts-test-"));
    embeddedDir = join(tempDir, "embedded");
    await mkdir(join(tempDir, ".cc-framework", "scripts"), { recursive: true });
    await mkdir(embeddedDir, { recursive: true });
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

  it("project scripts override embedded", async () => {
    await writeFile(join(embeddedDir, "setup.sh"), "embedded");
    await writeFile(join(tempDir, ".cc-framework", "scripts", "setup.sh"), "project");

    const config = makeConfig(tempDir);
    const scripts = await discoverScripts(config, embeddedDir);

    expect(scripts).toHaveLength(1);
    expect(scripts[0].source).toBe("project");
  });
});
