/** Hierarchical configuration loader: defaults → global → project → env overrides. */

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import type { GlobalConfig, ProjectConfig, ResolvedConfig } from "./types.ts";
import { CONFIG_DEFAULTS } from "./types.ts";

/** Home directory for cc-framework global config. */
function getGlobalHome(): string {
  return process.env.CCF_HOME ?? join(homedir(), ".cc-framework");
}

/** Try to read and parse a YAML file, return null if missing. */
async function loadYaml<T>(path: string): Promise<T | null> {
  try {
    const content = await readFile(path, "utf-8");
    return parseYaml(content) as T;
  } catch {
    return null;
  }
}

/**
 * Load and merge configuration from all levels.
 *
 * Resolution order (later overrides earlier):
 * 1. Built-in defaults
 * 2. Global config (~/.cc-framework/config.yaml)
 * 3. Project config (.cc-framework/config.yaml)
 * 4. Environment variables (CCF_MODEL, CCF_HOME)
 */
export async function loadConfig(
  projectRoot: string,
  embeddedWorkflows: string = "",
): Promise<ResolvedConfig> {
  const globalHome = getGlobalHome();
  const globalConfigPath = join(globalHome, "config.yaml");
  const projectConfigDir = join(projectRoot, ".cc-framework");
  const projectConfigPath = join(projectConfigDir, "config.yaml");

  // Load config files (null if missing)
  const globalCfg = await loadYaml<GlobalConfig>(globalConfigPath);
  const projectCfg = await loadYaml<ProjectConfig>(projectConfigPath);

  // Resolve paths
  const paths: ResolvedConfig["paths"] = {
    embeddedWorkflows,
    globalHome,
    globalWorkflows: globalCfg?.workflowsDir ?? join(globalHome, "workflows"),
    database: globalCfg?.databasePath ?? join(globalHome, "cc-framework.db"),
    projectRoot,
    projectConfig: projectConfigDir,
    projectWorkflows: projectCfg?.workflowsDir
      ? join(projectRoot, projectCfg.workflowsDir)
      : join(projectConfigDir, "workflows"),
    projectPrompts: projectCfg?.promptsDir
      ? join(projectRoot, projectCfg.promptsDir)
      : join(projectConfigDir, "prompts"),
    projectScripts: projectCfg?.scriptsDir
      ? join(projectRoot, projectCfg.scriptsDir)
      : join(projectConfigDir, "scripts"),
    docsDir: projectCfg?.docsDir
      ? join(projectRoot, projectCfg.docsDir)
      : join(projectRoot, "docs"),
  };

  // Database URL: env var takes precedence, falls back to file path
  const databaseUrl = process.env.CCF_DATABASE_URL ?? undefined;

  // Merge: defaults ← global ← project ← env
  const config: ResolvedConfig = {
    model: process.env.CCF_MODEL ?? projectCfg?.model ?? globalCfg?.model ?? CONFIG_DEFAULTS.model,
    effort: projectCfg?.effort ?? globalCfg?.effort ?? CONFIG_DEFAULTS.effort,
    isolation: {
      strategy:
        projectCfg?.isolation?.strategy ??
        globalCfg?.isolation?.strategy ??
        CONFIG_DEFAULTS.isolation.strategy,
      branch_prefix:
        projectCfg?.isolation?.branch_prefix ??
        globalCfg?.isolation?.branch_prefix ??
        CONFIG_DEFAULTS.isolation.branch_prefix,
    },
    ...(databaseUrl ? { databaseUrl } : {}),
    paths,
  };

  return config;
}

/**
 * Initialize the .cc-framework/ directory structure in a project.
 * Creates config.yaml, workflows/, prompts/, scripts/ directories.
 */
export async function initProject(projectRoot: string): Promise<void> {
  const configDir = join(projectRoot, ".cc-framework");

  await mkdir(join(configDir, "workflows"), { recursive: true });
  await mkdir(join(configDir, "prompts"), { recursive: true });
  await mkdir(join(configDir, "scripts"), { recursive: true });

  // Write default config.yaml if it doesn't exist
  const configPath = join(configDir, "config.yaml");
  try {
    await readFile(configPath);
  } catch {
    const defaultConfig: ProjectConfig = {};
    await writeFile(configPath, stringifyYaml(defaultConfig));
  }
}

/**
 * Ensure the global ~/.cc-framework/ directory exists with default config.
 */
export async function ensureGlobalHome(): Promise<string> {
  const globalHome = getGlobalHome();

  await mkdir(join(globalHome, "workflows"), { recursive: true });

  const configPath = join(globalHome, "config.yaml");
  try {
    await readFile(configPath);
  } catch {
    const defaultConfig: GlobalConfig = {};
    await writeFile(configPath, stringifyYaml(defaultConfig));
  }

  return globalHome;
}
