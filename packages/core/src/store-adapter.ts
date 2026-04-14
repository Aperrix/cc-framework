import type { ResolvedConfig } from "./config/types.ts";

/**
 * Convert ResolvedConfig to the narrow WorkflowConfig interface.
 * Used by CLI/MCP to pass config to the workflow engine.
 */
export function toWorkflowConfig(config: ResolvedConfig) {
  return {
    model: config.model,
    effort: config.effort,
    isolation: config.isolation,
    paths: {
      embeddedWorkflows: config.paths.embeddedWorkflows,
      globalWorkflows: config.paths.globalWorkflows,
      projectRoot: config.paths.projectRoot,
      projectWorkflows: config.paths.projectWorkflows,
      projectPrompts: config.paths.projectPrompts,
      projectScripts: config.paths.projectScripts,
      docsDir: config.paths.docsDir,
      database: config.paths.database,
      databaseUrl: config.databaseUrl,
    },
  };
}
