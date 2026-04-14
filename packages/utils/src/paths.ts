/** Centralized path resolution for cc-framework. */

import { join } from "node:path";
import { homedir } from "node:os";

/** Root directory for cc-framework global config. */
export function getCcfHome(): string {
  return process.env.CCF_HOME ?? join(homedir(), ".cc-framework");
}

export function getGlobalConfigPath(): string {
  return join(getCcfHome(), "config.yaml");
}

export function getGlobalWorkflowsPath(): string {
  return join(getCcfHome(), "workflows");
}

export function getGlobalDatabasePath(): string {
  return join(getCcfHome(), "cc-framework.db");
}

export function getProjectConfigDir(projectRoot: string): string {
  return join(projectRoot, ".cc-framework");
}

export function getProjectConfigPath(projectRoot: string): string {
  return join(getProjectConfigDir(projectRoot), "config.yaml");
}

export function getProjectWorkflowsPath(projectRoot: string): string {
  return join(getProjectConfigDir(projectRoot), "workflows");
}

export function getProjectPromptsPath(projectRoot: string): string {
  return join(getProjectConfigDir(projectRoot), "prompts");
}

export function getProjectScriptsPath(projectRoot: string): string {
  return join(getProjectConfigDir(projectRoot), "scripts");
}

export function getRunArtifactsPath(projectRoot: string, runId: string): string {
  return join(projectRoot, ".cc-framework", "artifacts", runId);
}

export function getRunLogPath(projectRoot: string, runId: string): string {
  return join(projectRoot, ".cc-framework", "logs", `${runId}.jsonl`);
}
