import BetterSqlite3 from "better-sqlite3";

export type Database = BetterSqlite3.Database;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('embedded', 'custom')),
    yaml_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id),
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
    arguments TEXT,
    branch TEXT,
    worktree_path TEXT,
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

  CREATE INDEX IF NOT EXISTS idx_runs_workflow ON runs(workflow_id);
  CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
  CREATE INDEX IF NOT EXISTS idx_node_executions_run ON node_executions(run_id);
  CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id);
`;

export function createDatabase(path: string): Database {
  const db = new BetterSqlite3(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}
