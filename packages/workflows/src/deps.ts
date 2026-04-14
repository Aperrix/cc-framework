/**
 * Workflow dependency injection types.
 *
 * Defines narrow interfaces for what the workflow engine needs from external
 * systems. Callers (CLI, MCP) satisfy these structurally — no adapter wrappers
 * needed. This keeps @cc-framework/workflows independent of @cc-framework/core.
 */

// ---- Narrow config interface (subset of ResolvedConfig) ----

export interface WorkflowPaths {
  embeddedWorkflows: string;
  globalWorkflows: string;
  projectRoot: string;
  projectWorkflows: string;
  projectPrompts: string;
  projectScripts: string;
  docsDir: string;
  database: string;
  databaseUrl?: string;
}

export interface WorkflowConfig {
  model: string;
  effort: string;
  isolation: {
    strategy: string;
    branch_prefix: string;
  };
  paths: WorkflowPaths;
}

/** Default config for the workflow engine when none is provided. */
export const WORKFLOW_DEFAULTS: WorkflowConfig = {
  model: "sonnet",
  effort: "high",
  isolation: { strategy: "branch", branch_prefix: "ccf/" },
  paths: {
    embeddedWorkflows: "",
    globalWorkflows: "",
    projectRoot: "",
    projectWorkflows: "",
    projectPrompts: "",
    projectScripts: "",
    docsDir: "",
    database: "",
  },
};
