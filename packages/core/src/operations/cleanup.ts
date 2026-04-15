/**
 * Cleanup service — runs maintenance tasks on demand.
 *
 * Combines orphaned run recovery, stale session expiry, and worktree cleanup.
 * Called at startup (via createCliContext/createMcpContext) or on-demand.
 */

import type { StoreQueries } from "@cc-framework/workflows";
import { cleanupOrphanedWorktrees } from "@cc-framework/workflows";
import { createLogger, type Logger } from "@cc-framework/utils";

let cachedLog: Logger | undefined;
function getLog(): Logger {
  if (!cachedLog) cachedLog = createLogger("cleanup");
  return cachedLog;
}

/** Default session inactivity threshold: 24 hours. */
const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Result of a cleanup run. */
export interface CleanupResult {
  orphanedRuns: number;
  expiredSessions: number;
  cleanedWorktrees: number;
}

/**
 * Run all maintenance cleanup tasks.
 *
 * - Mark orphaned runs (still "running" from a previous crash) as failed
 * - Expire inactive sessions older than the TTL
 * - Clean up orphaned/merged worktrees
 */
export async function runCleanup(
  store: StoreQueries,
  cwd: string,
  options?: {
    sessionTtlMs?: number;
    branchPrefix?: string;
    baseBranch?: string;
  },
): Promise<CleanupResult> {
  const ttl = options?.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const prefix = options?.branchPrefix ?? "ccf/";
  const base = options?.baseBranch ?? "main";

  const orphanedRuns = store.failOrphanedRuns();
  if (orphanedRuns > 0) {
    getLog().info({ count: orphanedRuns }, "cleanup.orphaned_runs_recovered");
  }

  const expiredSessions = store.expireStaleSessions(ttl);
  if (expiredSessions > 0) {
    getLog().info({ count: expiredSessions, ttlMs: ttl }, "cleanup.stale_sessions_expired");
  }

  let cleanedWorktrees = 0;
  try {
    cleanedWorktrees = await cleanupOrphanedWorktrees(cwd, prefix, base);
    if (cleanedWorktrees > 0) {
      getLog().info({ count: cleanedWorktrees }, "cleanup.orphaned_worktrees_removed");
    }
  } catch {
    // Worktree cleanup is best-effort — may fail if cwd is not a git repo
  }

  return { orphanedRuns, expiredSessions, cleanedWorktrees };
}
