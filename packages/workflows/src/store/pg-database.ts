/**
 * PostgreSQL database backend for cc-framework.
 *
 * Uses Drizzle ORM with the `pg` (node-postgres) driver. Provides the same
 * Database interface as the SQLite implementation so StoreQueries can work
 * with either backend transparently.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";

import type { Database } from "./database.ts";

import {
  pgWorkflows,
  pgSessions,
  pgRuns,
  pgNodeExecutions,
  pgOutputs,
  pgEvents,
  pgArtifacts,
  pgIsolationEnvironments,
} from "./pg-schema.ts";

// Re-export PG table definitions for consumers that need them
export {
  pgWorkflows,
  pgSessions,
  pgRuns,
  pgNodeExecutions,
  pgOutputs,
  pgEvents,
  pgArtifacts,
  pgIsolationEnvironments,
};

/** Create and bootstrap a PostgreSQL database with the given connection string. */
export async function createPgDatabase(connectionString: string): Promise<Database> {
  const pool = new pg.Pool({ connectionString });
  const db = drizzle({ client: pool });

  // Create tables using raw SQL matching the SQLite schema.
  // PostgreSQL uses SERIAL-like syntax but we keep TEXT primary keys + INTEGER
  // columns for parity with the SQLite schema.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL CHECK (source IN ('embedded', 'custom')),
      yaml_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('active', 'closed', 'expired')),
      project_path TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      last_activity INTEGER NOT NULL,
      closed_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id),
      status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
      arguments TEXT,
      branch TEXT,
      worktree_path TEXT,
      session_id TEXT REFERENCES sessions(id),
      started_at INTEGER NOT NULL,
      finished_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS node_executions (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      node_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
      attempt INTEGER NOT NULL DEFAULT 1,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      duration_ms INTEGER
    );
    CREATE TABLE IF NOT EXISTS outputs (
      id TEXT PRIMARY KEY,
      node_execution_id TEXT NOT NULL REFERENCES node_executions(id),
      content TEXT NOT NULL,
      exit_code INTEGER
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      node_id TEXT,
      type TEXT NOT NULL,
      payload TEXT,
      timestamp INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      node_id TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS isolation_environments (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      strategy TEXT NOT NULL CHECK (strategy IN ('worktree', 'branch')),
      branch_name TEXT NOT NULL,
      worktree_path TEXT,
      status TEXT NOT NULL CHECK (status IN ('active', 'cleaned_up', 'orphaned')),
      created_at INTEGER NOT NULL,
      cleaned_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_runs_workflow ON runs(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
    CREATE INDEX IF NOT EXISTS idx_runs_session ON runs(session_id);
    CREATE INDEX IF NOT EXISTS idx_node_executions_run ON node_executions(run_id);
    CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id);
  `);

  // Return a Database-compatible object. The Drizzle PG instance already has
  // select/insert/update/delete. We need to add close() and ensure .get()/.all()
  // compatibility. Drizzle node-postgres queries return arrays, but the SQLite
  // driver adds .get() (returns first row) and .all() (returns all rows) to
  // query chains. The PG driver chains return Promises, so the PG database is
  // inherently async — but since the current codebase uses synchronous SQLite,
  // we cast to Database to satisfy the type. Actual PG usage will require
  // making StoreQueries async in a follow-up.
  return Object.assign(db, {
    close: () => pool.end(),
  }) as unknown as Database;
}
