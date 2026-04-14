import { drizzle } from "drizzle-orm/better-sqlite3";
import BetterSqlite3 from "better-sqlite3";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// --- Table definitions ---

export const workflows = sqliteTable("workflows", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  source: text("source", { enum: ["embedded", "custom"] }).notNull(),
  yamlHash: text("yaml_hash").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflows.id),
    status: text("status", {
      enum: ["pending", "running", "paused", "completed", "failed", "cancelled"],
    }).notNull(),
    arguments: text("arguments"),
    branch: text("branch"),
    worktreePath: text("worktree_path"),
    startedAt: integer("started_at", { mode: "number" }).notNull(),
    finishedAt: integer("finished_at", { mode: "number" }),
  },
  (table) => [
    index("idx_runs_workflow").on(table.workflowId),
    index("idx_runs_status").on(table.status),
  ],
);

export const nodeExecutions = sqliteTable(
  "node_executions",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    nodeId: text("node_id").notNull(),
    status: text("status", {
      enum: ["pending", "running", "completed", "failed", "skipped"],
    }).notNull(),
    attempt: integer("attempt").notNull().default(1),
    startedAt: integer("started_at", { mode: "number" }).notNull(),
    finishedAt: integer("finished_at", { mode: "number" }),
    durationMs: integer("duration_ms"),
  },
  (table) => [index("idx_node_executions_run").on(table.runId)],
);

export const outputs = sqliteTable("outputs", {
  id: text("id").primaryKey(),
  nodeExecutionId: text("node_execution_id")
    .notNull()
    .references(() => nodeExecutions.id),
  content: text("content").notNull(),
  exitCode: integer("exit_code"),
});

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    nodeId: text("node_id"),
    type: text("type").notNull(),
    payload: text("payload"),
    timestamp: integer("timestamp", { mode: "number" }).notNull(),
  },
  (table) => [index("idx_events_run").on(table.runId)],
);

export const artifacts = sqliteTable("artifacts", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id),
  nodeId: text("node_id").notNull(),
  path: text("path").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});

export const isolationEnvironments = sqliteTable("isolation_environments", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id),
  strategy: text("strategy", { enum: ["worktree", "branch"] }).notNull(),
  branchName: text("branch_name").notNull(),
  worktreePath: text("worktree_path"),
  status: text("status", { enum: ["active", "cleaned_up", "orphaned"] }).notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  cleanedAt: integer("cleaned_at", { mode: "number" }),
});

// --- Status types (derived from enum definitions) ---

export type RunStatus = "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";
export type NodeExecutionStatus = "pending" | "running" | "completed" | "failed" | "skipped";

// --- Database types ---

export type Database = ReturnType<typeof createDatabase>;

// --- Database creation ---

export function createDatabase(path: string) {
  const sqlite = new BetterSqlite3(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle({ client: sqlite });

  // Create tables using raw SQL. Drizzle doesn't auto-create tables, and we
  // don't need migration tracking for an embedded database. CHECK constraints
  // are preserved here since Drizzle table definitions don't support them.
  const createSQL = `
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
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
  sqlite.exec(createSQL);

  // Attach close method for lifecycle management
  return Object.assign(db, { close: () => sqlite.close() });
}
