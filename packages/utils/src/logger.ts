/**
 * Structured logging with child loggers and level filtering.
 *
 * Usage:
 *   import { createLogger } from '@cc-framework/utils';
 *   const log = createLogger('executor');
 *   log.info({ runId, nodeId }, 'node_started');
 *   log.error({ err }, 'node_failed');
 *
 * Log levels (ordered by severity):
 *   error (40) - Failures needing immediate attention
 *   warn  (30) - Degraded behavior, fallbacks
 *   info  (20) - Key user-visible events (DEFAULT)
 *   debug (10) - Internal details, state transitions
 *
 * Configuration:
 *   LOG_LEVEL env var or setLogLevel() at startup
 */

// ---- Types ----

export const LOG_LEVELS = ["debug", "info", "warn", "error", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

const VALID_LEVELS = new Set<string>(LOG_LEVELS);

export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  debug(ctx: LogContext, msg: string): void;
  debug(msg: string): void;
  info(ctx: LogContext, msg: string): void;
  info(msg: string): void;
  warn(ctx: LogContext, msg: string): void;
  warn(msg: string): void;
  error(ctx: LogContext, msg: string): void;
  error(msg: string): void;
  child(bindings: LogContext): Logger;
}

/** Function that receives formatted log output. Replaceable for testing. */
export type LogWriter = (level: LogLevel, module: string, ctx: LogContext, msg: string) => void;

// ---- Level Management ----

function getInitialLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel && VALID_LEVELS.has(envLevel)) {
    return envLevel as LogLevel;
  }
  return "info";
}

let currentLevel: LogLevel = getInitialLevel();

/** Set the global log level. Affects all loggers. */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/** Get the current global log level. */
export function getLogLevel(): LogLevel {
  return currentLevel;
}

// ---- Writer ----

const PREFIX = "[ccf]";

function defaultWriter(level: LogLevel, module: string, ctx: LogContext, msg: string): void {
  const parts: unknown[] = [PREFIX, `[${module}]`];

  // Add structured context fields inline
  for (const [key, value] of Object.entries(ctx)) {
    if (value !== undefined) {
      parts.push(typeof value === "string" ? `[${value}]` : `${key}=${JSON.stringify(value)}`);
    }
  }

  parts.push(msg);

  switch (level) {
    case "error":
      console.error(...parts);
      break;
    case "warn":
      console.warn(...parts);
      break;
    case "debug":
      console.debug(...parts);
      break;
    default:
      // eslint-disable-next-line no-console
      console.error(...parts);
  }
}

let writer: LogWriter = defaultWriter;

/** Set a custom log writer (for testing or custom output). */
export function setLogWriter(w: LogWriter): void {
  writer = w;
}

/** Reset to the default console writer. */
export function resetLogWriter(): void {
  writer = defaultWriter;
}

// ---- Logger Implementation ----

function makeLogger(module: string, bindings: LogContext): Logger {
  function emit(level: LogLevel, args: [LogContext, string] | [string]): void {
    if (LEVEL_VALUES[level] < LEVEL_VALUES[currentLevel]) return;

    const [ctxOrMsg, maybeMsg] = args;
    const ctx = typeof ctxOrMsg === "string" ? { ...bindings } : { ...bindings, ...ctxOrMsg };
    const msg = typeof ctxOrMsg === "string" ? ctxOrMsg : maybeMsg!;

    writer(level, module, ctx, msg);
  }

  return {
    debug: (...args: [LogContext, string] | [string]) => emit("debug", args),
    info: (...args: [LogContext, string] | [string]) => emit("info", args),
    warn: (...args: [LogContext, string] | [string]) => emit("warn", args),
    error: (...args: [LogContext, string] | [string]) => emit("error", args),
    child: (extra: LogContext) => makeLogger(module, { ...bindings, ...extra }),
  };
}

/**
 * Create a named logger for a module.
 *
 * @param module - Module name (e.g. 'executor', 'discovery', 'store')
 * @returns Logger with debug/info/warn/error methods and child() for sub-contexts
 */
export function createLogger(module: string): Logger {
  return makeLogger(module, {});
}
