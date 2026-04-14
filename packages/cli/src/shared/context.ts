/** Shared CLI context — initializes config, database, store, and session. */

import { loadConfig, ensureGlobalHome, type ResolvedConfig } from "@cc-framework/core";
import { DEFAULTS_DIR, createDatabase, StoreQueries, type Database } from "@cc-framework/workflows";

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

  // Session management — resume or create
  const existingSession = store.getActiveSession(cwd);
  const sessionId = existingSession?.id ?? store.createSession(cwd);

  return { config, db, store, sessionId, cwd };
}

/** Clean up resources on exit. */
export function destroyCliContext(ctx: CliContext): void {
  ctx.db.close();
}
