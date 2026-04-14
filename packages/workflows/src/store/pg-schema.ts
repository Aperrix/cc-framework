/** PostgreSQL table definitions matching the SQLite schema in database.ts. */

import { pgTable, text, integer, index } from "drizzle-orm/pg-core";

import {
  WORKFLOW_SOURCES,
  RUN_STATUSES,
  NODE_EXECUTION_STATUSES,
  ISOLATION_STATUSES,
  ISOLATION_STRATEGIES,
  SESSION_STATUSES,
} from "../constants.ts";

// ---- Table Definitions ----

export const pgWorkflows = pgTable("workflows", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  source: text("source", { enum: [...WORKFLOW_SOURCES] }).notNull(),
  yamlHash: text("yaml_hash").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const pgSessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    status: text("status", { enum: [...SESSION_STATUSES] }).notNull(),
    projectPath: text("project_path").notNull(),
    metadata: text("metadata"),
    createdAt: integer("created_at").notNull(),
    lastActivity: integer("last_activity").notNull(),
    closedAt: integer("closed_at"),
  },
  (table) => [index("idx_sessions_status").on(table.status)],
);

export const pgRuns = pgTable(
  "runs",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => pgWorkflows.id),
    status: text("status", { enum: [...RUN_STATUSES] }).notNull(),
    arguments: text("arguments"),
    branch: text("branch"),
    worktreePath: text("worktree_path"),
    sessionId: text("session_id").references(() => pgSessions.id),
    startedAt: integer("started_at").notNull(),
    finishedAt: integer("finished_at"),
  },
  (table) => [
    index("idx_runs_workflow").on(table.workflowId),
    index("idx_runs_status").on(table.status),
    index("idx_runs_session").on(table.sessionId),
  ],
);

export const pgNodeExecutions = pgTable(
  "node_executions",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => pgRuns.id),
    nodeId: text("node_id").notNull(),
    status: text("status", { enum: [...NODE_EXECUTION_STATUSES] }).notNull(),
    attempt: integer("attempt").notNull().default(1),
    startedAt: integer("started_at").notNull(),
    finishedAt: integer("finished_at"),
    durationMs: integer("duration_ms"),
  },
  (table) => [index("idx_node_executions_run").on(table.runId)],
);

export const pgOutputs = pgTable("outputs", {
  id: text("id").primaryKey(),
  nodeExecutionId: text("node_execution_id")
    .notNull()
    .references(() => pgNodeExecutions.id),
  content: text("content").notNull(),
  exitCode: integer("exit_code"),
});

export const pgEvents = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => pgRuns.id),
    nodeId: text("node_id"),
    type: text("type").notNull(),
    payload: text("payload"),
    timestamp: integer("timestamp").notNull(),
  },
  (table) => [index("idx_events_run").on(table.runId)],
);

export const pgArtifacts = pgTable("artifacts", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => pgRuns.id),
  nodeId: text("node_id").notNull(),
  path: text("path").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const pgIsolationEnvironments = pgTable("isolation_environments", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => pgRuns.id),
  strategy: text("strategy", { enum: [...ISOLATION_STRATEGIES] }).notNull(),
  branchName: text("branch_name").notNull(),
  worktreePath: text("worktree_path"),
  status: text("status", { enum: [...ISOLATION_STATUSES] }).notNull(),
  createdAt: integer("created_at").notNull(),
  cleanedAt: integer("cleaned_at"),
});
