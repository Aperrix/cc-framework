/** Shared CLI context — initializes config, database, store, and session. */

import { loadConfig, ensureGlobalHome, type ResolvedConfig } from "@cc-framework/core";
import { DEFAULTS_DIR, createDatabase, StoreQueries, type Database } from "@cc-framework/workflows";

/** Default session inactivity threshold: 24 hours. */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface CliContext {
  config: ResolvedConfig;
  db: Database;
  store: StoreQueries;
  sessionId: string;
  cwd: string;
}

/**
 * Initialize the CLI context. Called once at startup.
 * Loads config, opens DB, performs crash recovery, creates/resumes session.
 */
export async function createCliContext(cwd: string): Promise<CliContext> {
  await ensureGlobalHome();
  const config = await loadConfig(cwd, DEFAULTS_DIR);
  const db = createDatabase(config.paths.database);
  const store = new StoreQueries(db);

  // Crash recovery — mark orphaned runs as failed
  store.failOrphanedRuns();

  // Expire stale sessions (same TTL as MCP)
  store.expireStaleSessions(SESSION_TTL_MS);

  // Session management — resume or create
  const existingSession = store.getActiveSession(cwd);
  const sessionId = existingSession?.id ?? store.createSession(cwd);

  return { config, db, store, sessionId, cwd };
}

/** Clean up resources on exit. */
export function destroyCliContext(ctx: CliContext): void {
  ctx.store.closeSession(ctx.sessionId);
  ctx.db.close();
}
