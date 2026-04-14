import { randomUUID } from "node:crypto";
import type { Database } from "./database.ts";

interface WorkflowRow {
  id: string;
  name: string;
  source: string;
  yaml_hash: string;
  created_at: number;
  updated_at: number;
}

interface RunRow {
  id: string;
  workflow_id: string;
  status: string;
  arguments: string | null;
  branch: string | null;
  worktree_path: string | null;
  started_at: number;
  finished_at: number | null;
}

interface NodeExecutionRow {
  id: string;
  run_id: string;
  node_id: string;
  status: string;
  attempt: number;
  started_at: number;
  finished_at: number | null;
  duration_ms: number | null;
}

interface OutputRow {
  id: string;
  node_execution_id: string;
  content: string;
  exit_code: number | null;
}

interface EventRow {
  id: string;
  run_id: string;
  node_id: string | null;
  type: string;
  payload: string | null;
  timestamp: number;
}

export class StoreQueries {
  constructor(private db: Database) {}

  upsertWorkflow(name: string, source: string, yamlHash: string): string {
    const now = Date.now();
    const existing = this.db.prepare("SELECT id FROM workflows WHERE name = ?").get(name) as
      | { id: string }
      | undefined;
    if (existing) {
      this.db
        .prepare("UPDATE workflows SET source = ?, yaml_hash = ?, updated_at = ? WHERE id = ?")
        .run(source, yamlHash, now, existing.id);
      return existing.id;
    }
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO workflows (id, name, source, yaml_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(id, name, source, yamlHash, now, now);
    return id;
  }

  getWorkflow(id: string): WorkflowRow | null {
    return (this.db.prepare("SELECT * FROM workflows WHERE id = ?").get(id) as WorkflowRow) ?? null;
  }

  createRun(workflowId: string, args?: string): string {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO runs (id, workflow_id, status, arguments, started_at) VALUES (?, ?, 'pending', ?, ?)",
      )
      .run(id, workflowId, args ?? null, Date.now());
    return id;
  }

  getRun(id: string): RunRow | null {
    return (this.db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunRow) ?? null;
  }

  updateRunStatus(id: string, status: string): void {
    const finishedAt = ["completed", "failed", "cancelled"].includes(status) ? Date.now() : null;
    this.db
      .prepare("UPDATE runs SET status = ?, finished_at = COALESCE(?, finished_at) WHERE id = ?")
      .run(status, finishedAt, id);
  }

  createNodeExecution(runId: string, nodeId: string, attempt: number): string {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO node_executions (id, run_id, node_id, status, attempt, started_at) VALUES (?, ?, ?, 'pending', ?, ?)",
      )
      .run(id, runId, nodeId, attempt, Date.now());
    return id;
  }

  getNodeExecution(id: string): NodeExecutionRow | null {
    return (
      (this.db.prepare("SELECT * FROM node_executions WHERE id = ?").get(id) as NodeExecutionRow) ??
      null
    );
  }

  updateNodeExecutionStatus(id: string, status: string, durationMs?: number): void {
    const finishedAt = ["completed", "failed", "skipped"].includes(status) ? Date.now() : null;
    this.db
      .prepare(
        "UPDATE node_executions SET status = ?, finished_at = COALESCE(?, finished_at), duration_ms = COALESCE(?, duration_ms) WHERE id = ?",
      )
      .run(status, finishedAt, durationMs ?? null, id);
  }

  saveOutput(nodeExecutionId: string, content: string, exitCode?: number | null): string {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO outputs (id, node_execution_id, content, exit_code) VALUES (?, ?, ?, ?)",
      )
      .run(id, nodeExecutionId, content, exitCode ?? null);
    return id;
  }

  getOutput(nodeExecutionId: string): OutputRow | null {
    return (
      (this.db
        .prepare("SELECT * FROM outputs WHERE node_execution_id = ?")
        .get(nodeExecutionId) as OutputRow) ?? null
    );
  }

  recordEvent(runId: string, nodeId: string | null, type: string, payload?: string): string {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO events (id, run_id, node_id, type, payload, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(id, runId, nodeId, type, payload ?? null, Date.now());
    return id;
  }

  getEvents(runId: string): EventRow[] {
    return this.db
      .prepare("SELECT * FROM events WHERE run_id = ? ORDER BY timestamp ASC")
      .all(runId) as EventRow[];
  }

  getNodeOutputs(runId: string): Record<string, { output: string }> {
    const rows = this.db
      .prepare(`
      SELECT ne.node_id, o.content
      FROM node_executions ne
      JOIN outputs o ON o.node_execution_id = ne.id
      WHERE ne.run_id = ? AND ne.status = 'completed'
      ORDER BY ne.finished_at DESC
    `)
      .all(runId) as { node_id: string; content: string }[];

    const result: Record<string, { output: string }> = {};
    for (const row of rows) {
      if (!result[row.node_id]) {
        result[row.node_id] = { output: row.content };
      }
    }
    return result;
  }
}
