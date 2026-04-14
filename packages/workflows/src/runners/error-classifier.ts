/** Classifies execution errors as fatal or transient to guide retry decisions. */

// ---- Types ----

export type ErrorSeverity = "fatal" | "transient" | "unknown";

export interface ClassifiedError {
  severity: ErrorSeverity;
  message: string;
  original: unknown;
}

// ---- Patterns ----

/** Errors that should never be retried — the problem won't fix itself. */
const FATAL_PATTERNS = [
  /auth/i,
  /authentication/i,
  /permission/i,
  /forbidden/i,
  /unauthorized/i,
  /invalid.?api.?key/i,
  /credit/i,
  /billing/i,
  /quota exceeded/i,
];

/** Errors that are likely transient — retrying may succeed. */
const TRANSIENT_PATTERNS = [
  /rate.?limit/i,
  /429/,
  /too many requests/i,
  /timeout/i,
  /ETIMEDOUT/,
  /ECONNRESET/,
  /ECONNREFUSED/,
  /socket hang up/i,
  /network/i,
  /overloaded/i,
  /503/,
  /529/,
  /subprocess.*crash/i,
  /exit code/i,
];

// ---- Classifier ----

/** Classify an error to determine if it's safe to retry. */
export function classifyError(error: unknown): ClassifiedError {
  const message = error instanceof Error ? error.message : String(error);

  for (const pattern of FATAL_PATTERNS) {
    if (pattern.test(message)) {
      return { severity: "fatal", message, original: error };
    }
  }

  for (const pattern of TRANSIENT_PATTERNS) {
    if (pattern.test(message)) {
      return { severity: "transient", message, original: error };
    }
  }

  return { severity: "unknown", message, original: error };
}

/** Check if an error is retryable given the node's retry config scope. */
export function isRetryable(classified: ClassifiedError, scope: "transient" | "all"): boolean {
  if (classified.severity === "fatal") return false;
  if (scope === "all") return true;
  return classified.severity === "transient";
}
