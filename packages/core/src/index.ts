/** Public API surface for @cc-framework/core. */

// ---- Config ----
export { loadConfig, initProject, ensureGlobalHome } from "./config/loader.ts";
export { CONFIG_DEFAULTS } from "./config/types.ts";
export type { GlobalConfig, ProjectConfig, ResolvedConfig } from "./config/types.ts";

// ---- Logging ----
export {
  log,
  setLogHandler,
  resetLogHandler,
  logWorkflowStart,
  logWorkflowComplete,
  logWorkflowError,
  logNodeStart,
  logNodeComplete,
  logNodeSkip,
  logNodeError,
  type LogLevel,
  type LogEntry,
  type LogHandler,
} from "./logger.ts";
