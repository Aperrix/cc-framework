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
