/** Configuration type definitions for cc-framework. */

import type { EffortLevel, IsolationStrategy } from "../constants.ts";

/** Global config (~/.cc-framework/config.yaml) — user-wide defaults. */
export interface GlobalConfig {
  /** Default Claude model to use for AI nodes. */
  model?: string;
  /** Default effort level for AI nodes. */
  effort?: EffortLevel;
  /** Default isolation strategy for workflows. */
  isolation?: {
    strategy?: IsolationStrategy;
    branch_prefix?: string;
  };
  /** Path to the global workflows directory (default: ~/.cc-framework/workflows/). */
  workflowsDir?: string;
  /** Path to the SQLite database (default: ~/.cc-framework/cc-framework.db). */
  databasePath?: string;
}

/** Project config (.cc-framework/config.yaml) — per-project overrides. */
export interface ProjectConfig {
  /** Claude model override for this project. */
  model?: string;
  /** Effort level override. */
  effort?: EffortLevel;
  /** Isolation override. */
  isolation?: {
    strategy?: IsolationStrategy;
    branch_prefix?: string;
  };
  /** Path to project prompts directory (default: .cc-framework/prompts/). */
  promptsDir?: string;
  /** Path to project scripts directory (default: .cc-framework/scripts/). */
  scriptsDir?: string;
  /** Path to project workflows directory (default: .cc-framework/workflows/). */
  workflowsDir?: string;
  /** Documentation directory for $DOCS_DIR variable. */
  docsDir?: string;
}

/** Merged config — all levels resolved with defaults filled in. */
export interface ResolvedConfig {
  model: string;
  effort: EffortLevel;
  isolation: {
    strategy: IsolationStrategy;
    branch_prefix: string;
  };
  paths: {
    globalHome: string;
    globalWorkflows: string;
    database: string;
    projectRoot: string;
    projectConfig: string;
    projectWorkflows: string;
    projectPrompts: string;
    projectScripts: string;
    docsDir: string;
  };
}

/** Built-in defaults that apply when no config is specified. */
export const CONFIG_DEFAULTS: ResolvedConfig = {
  model: "sonnet",
  effort: "high",
  isolation: {
    strategy: "branch",
    branch_prefix: "ccf/",
  },
  paths: {
    globalHome: "",
    globalWorkflows: "",
    database: "",
    projectRoot: "",
    projectConfig: "",
    projectWorkflows: "",
    projectPrompts: "",
    projectScripts: "",
    docsDir: "",
  },
};
