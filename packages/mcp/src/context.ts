/** MCP server context — initializes config, database, store, and session. */

import { loadConfig, ensureGlobalHome, type ResolvedConfig } from "@cc-framework/core";
import { DEFAULTS_DIR, createDatabase, StoreQueries, type Database } from "@cc-framework/workflows";

export interface McpContext {
  config: ResolvedConfig;
  db: Database;
  store: StoreQueries;
  sessionId: string;
  cwd: string;
}

/** Initialize server context. Called once at startup. */
export async function createMcpContext(cwd: string): Promise<McpContext> {
  await ensureGlobalHome();
  const config = await loadConfig(cwd, DEFAULTS_DIR);
  const db = createDatabase(config.paths.database);
  const store = new StoreQueries(db);

  // Crash recovery
  store.failOrphanedRuns();
  store.expireStaleSessions(24 * 60 * 60 * 1000);

  // Session — resume or create
  const existing = store.getActiveSession(cwd);
  const sessionId = existing?.id ?? store.createSession(cwd);

  return { config, db, store, sessionId, cwd };
}

/** Clean up on shutdown. */
export function destroyMcpContext(ctx: McpContext): void {
  ctx.store.closeSession(ctx.sessionId);
  ctx.db.close();
}
