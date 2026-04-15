/** Configuration type definitions for cc-framework — Zod schemas as source of truth. */

import { z } from "zod";

// ---- Shared enums ----

const EffortLevelSchema = z.enum(["low", "medium", "high", "max"]);
const IsolationStrategySchema = z.enum(["branch", "worktree"]);

const IsolationConfigSchema = z.object({
  strategy: IsolationStrategySchema.optional(),
  branch_prefix: z.string().optional(),
});

// ---- Config Schemas ----

/** Global config (~/.cc-framework/config.yaml) — user-wide defaults. */
export const GlobalConfigSchema = z.object({
  model: z.string().optional(),
  effort: EffortLevelSchema.optional(),
  isolation: IsolationConfigSchema.optional(),
  workflowsDir: z.string().optional(),
  databasePath: z.string().optional(),
});

/** Project config (.cc-framework/config.yaml) — per-project overrides. */
export const ProjectConfigSchema = z.object({
  model: z.string().optional(),
  effort: EffortLevelSchema.optional(),
  isolation: IsolationConfigSchema.optional(),
  promptsDir: z.string().optional(),
  scriptsDir: z.string().optional(),
  workflowsDir: z.string().optional(),
  docsDir: z.string().optional(),
});

// ---- Derived Types ----

export type EffortLevel = z.infer<typeof EffortLevelSchema>;
export type IsolationStrategy = z.infer<typeof IsolationStrategySchema>;
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

/** Merged config — all levels resolved with defaults filled in. */
export interface ResolvedConfig {
  model: string;
  effort: EffortLevel;
  isolation: {
    strategy: IsolationStrategy;
    branch_prefix: string;
  };
  /**
   * Database connection URL. When set, takes precedence over `paths.database`.
   * Supports `postgres://` / `postgresql://` for PostgreSQL or a file path /
   * ":memory:" for SQLite.
   */
  databaseUrl?: string;
  paths: {
    embeddedWorkflows: string;
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

/** Safe subset of ResolvedConfig for web clients. Excludes filesystem paths. */
export interface SafeConfig {
  model: string;
  effort: EffortLevel;
  isolation: {
    strategy: IsolationStrategy;
    branch_prefix: string;
  };
}

/** Extract SafeConfig from ResolvedConfig. */
export function toSafeConfig(config: ResolvedConfig): SafeConfig {
  return {
    model: config.model,
    effort: config.effort,
    isolation: config.isolation,
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
    embeddedWorkflows: "",
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
