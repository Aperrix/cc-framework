/** Public API surface for @cc-framework/utils. */

export {
  createLogger,
  setLogLevel,
  getLogLevel,
  setLogWriter,
  resetLogWriter,
  LOG_LEVELS,
  type Logger,
  type LogLevel,
  type LogContext,
  type LogWriter,
} from "./logger.ts";

export { sanitize, addPattern } from "./credential-sanitizer.ts";

export { stripClaudeCodeMarkers } from "./strip-cwd-env.ts";

export {
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
} from "./paths.ts";

export {
  CcfError,
  WorkflowNotFoundError,
  NodeExecutionError,
  ConfigError,
  ValidationError,
  formatError,
} from "./error.ts";
