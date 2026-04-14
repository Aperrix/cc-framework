import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { loadConfig, initProject, ensureGlobalHome } from "../../src/config/loader.ts";
import { mkdtemp, rm, writeFile, mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("loadConfig", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ccf-config-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns defaults when no config files exist", async () => {
    const config = await loadConfig(tempDir);
    expect(config.model).toBe("sonnet");
    expect(config.effort).toBe("high");
    expect(config.isolation.strategy).toBe("branch");
    expect(config.isolation.branch_prefix).toBe("ccf/");
  });

  it("loads and merges project config", async () => {
    const configDir = join(tempDir, ".cc-framework");
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, "config.yaml"), "model: opus\neffort: max\n");

    const config = await loadConfig(tempDir);
    expect(config.model).toBe("opus");
    expect(config.effort).toBe("max");
    // Defaults still apply for unset fields
    expect(config.isolation.strategy).toBe("branch");
  });

  it("resolves project paths correctly", async () => {
    const config = await loadConfig(tempDir);
    expect(config.paths.projectRoot).toBe(tempDir);
    expect(config.paths.projectWorkflows).toBe(join(tempDir, ".cc-framework", "workflows"));
    expect(config.paths.projectPrompts).toBe(join(tempDir, ".cc-framework", "prompts"));
    expect(config.paths.projectScripts).toBe(join(tempDir, ".cc-framework", "scripts"));
    expect(config.paths.docsDir).toBe(join(tempDir, "docs"));
  });

  it("respects custom paths in project config", async () => {
    const configDir = join(tempDir, ".cc-framework");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "config.yaml"),
      "workflowsDir: custom/workflows\ndocsDir: documentation\n",
    );

    const config = await loadConfig(tempDir);
    expect(config.paths.projectWorkflows).toBe(join(tempDir, "custom/workflows"));
    expect(config.paths.docsDir).toBe(join(tempDir, "documentation"));
  });
});

describe("initProject", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ccf-init-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("does not overwrite existing config.yaml", async () => {
    const configDir = join(tempDir, ".cc-framework");
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, "config.yaml"), "model: opus\n");

    await initProject(tempDir);

    const { readFile } = await import("node:fs/promises");
    const content = await readFile(join(configDir, "config.yaml"), "utf-8");
    expect(content).toBe("model: opus\n");
  });

  it("creates the .cc-framework directory structure", async () => {
    await initProject(tempDir);

    expect((await stat(join(tempDir, ".cc-framework"))).isDirectory()).toBe(true);
    expect((await stat(join(tempDir, ".cc-framework", "workflows"))).isDirectory()).toBe(true);
    expect((await stat(join(tempDir, ".cc-framework", "prompts"))).isDirectory()).toBe(true);
    expect((await stat(join(tempDir, ".cc-framework", "scripts"))).isDirectory()).toBe(true);
    expect((await stat(join(tempDir, ".cc-framework", "config.yaml"))).isFile()).toBe(true);
  });
});

describe("ensureGlobalHome", () => {
  it("creates the global home directory and returns its path", async () => {
    const home = await ensureGlobalHome();
    expect(typeof home).toBe("string");
    expect(home.length).toBeGreaterThan(0);
  });
});
