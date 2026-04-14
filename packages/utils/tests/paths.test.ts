import { describe, expect, it, afterEach } from "vite-plus/test";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  getCcfHome,
  getGlobalConfigPath,
  getGlobalWorkflowsPath,
  getGlobalDatabasePath,
  getProjectConfigDir,
  getProjectConfigPath,
  getProjectWorkflowsPath,
  getProjectPromptsPath,
  getProjectScriptsPath,
  getRunArtifactsPath,
  getRunLogPath,
} from "../src/paths.ts";

describe("paths", () => {
  const originalCcfHome = process.env.CCF_HOME;

  afterEach(() => {
    if (originalCcfHome === undefined) {
      delete process.env.CCF_HOME;
    } else {
      process.env.CCF_HOME = originalCcfHome;
    }
  });

  it("getCcfHome returns default path", () => {
    delete process.env.CCF_HOME;
    expect(getCcfHome()).toBe(join(homedir(), ".cc-framework"));
  });

  it("getCcfHome respects CCF_HOME env var", () => {
    process.env.CCF_HOME = "/custom/path";
    expect(getCcfHome()).toBe("/custom/path");
  });

  it("getGlobalConfigPath returns config.yaml under home", () => {
    process.env.CCF_HOME = "/home/test/.cc-framework";
    expect(getGlobalConfigPath()).toBe("/home/test/.cc-framework/config.yaml");
  });

  it("getGlobalWorkflowsPath returns workflows dir under home", () => {
    process.env.CCF_HOME = "/home/test/.cc-framework";
    expect(getGlobalWorkflowsPath()).toBe("/home/test/.cc-framework/workflows");
  });

  it("getGlobalDatabasePath returns database file under home", () => {
    process.env.CCF_HOME = "/home/test/.cc-framework";
    expect(getGlobalDatabasePath()).toBe("/home/test/.cc-framework/cc-framework.db");
  });

  it("getProjectConfigDir returns correct path", () => {
    expect(getProjectConfigDir("/my/project")).toBe("/my/project/.cc-framework");
  });

  it("getProjectConfigPath returns config.yaml in project dir", () => {
    expect(getProjectConfigPath("/my/project")).toBe("/my/project/.cc-framework/config.yaml");
  });

  it("getProjectWorkflowsPath returns workflows in project dir", () => {
    expect(getProjectWorkflowsPath("/my/project")).toBe("/my/project/.cc-framework/workflows");
  });

  it("getProjectPromptsPath returns prompts in project dir", () => {
    expect(getProjectPromptsPath("/my/project")).toBe("/my/project/.cc-framework/prompts");
  });

  it("getProjectScriptsPath returns scripts in project dir", () => {
    expect(getProjectScriptsPath("/my/project")).toBe("/my/project/.cc-framework/scripts");
  });

  it("getRunArtifactsPath includes runId", () => {
    expect(getRunArtifactsPath("/my/project", "run-abc")).toBe(
      "/my/project/.cc-framework/artifacts/run-abc",
    );
  });

  it("getRunLogPath includes runId with .jsonl extension", () => {
    expect(getRunLogPath("/my/project", "run-abc")).toBe(
      "/my/project/.cc-framework/logs/run-abc.jsonl",
    );
  });
});
