import { randomUUID } from "node:crypto";
import { eq, and, desc } from "drizzle-orm";
import type { Database } from "./database.ts";
import {
  workflows,
  runs,
  nodeExecutions,
  outputs,
  events,
  artifacts,
  isolationEnvironments,
} from "./database.ts";

export class StoreQueries {
  constructor(private db: Database) {}

  upsertWorkflow(name: string, source: "embedded" | "custom", yamlHash: string): string {
    const now = Date.now();
    const existing = this.db
      .select({ id: workflows.id })
      .from(workflows)
      .where(eq(workflows.name, name))
      .get();

    if (existing) {
      this.db
        .update(workflows)
        .set({ source, yamlHash, updatedAt: now })
        .where(eq(workflows.id, existing.id))
        .run();
      return existing.id;
    }

    const id = randomUUID();
    this.db
      .insert(workflows)
      .values({ id, name, source, yamlHash, createdAt: now, updatedAt: now })
      .run();
    return id;
  }

  getWorkflow(id: string) {
    return this.db.select().from(workflows).where(eq(workflows.id, id)).get() ?? null;
  }

  createRun(workflowId: string, args?: string): string {
    const id = randomUUID();
    this.db
      .insert(runs)
      .values({
        id,
        workflowId,
        status: "pending",
        arguments: args ?? null,
        startedAt: Date.now(),
      })
      .run();
    return id;
  }

  getRun(id: string) {
    return this.db.select().from(runs).where(eq(runs.id, id)).get() ?? null;
  }

  updateRunStatus(id: string, status: string): void {
    const finishedAt = ["completed", "failed", "cancelled"].includes(status)
      ? Date.now()
      : undefined;
    this.db
      .update(runs)
      .set({ status: status as any, finishedAt })
      .where(eq(runs.id, id))
      .run();
  }

  createNodeExecution(runId: string, nodeId: string, attempt: number): string {
    const id = randomUUID();
    this.db
      .insert(nodeExecutions)
      .values({
        id,
        runId,
        nodeId,
        status: "pending",
        attempt,
        startedAt: Date.now(),
      })
      .run();
    return id;
  }

  getNodeExecution(id: string) {
    return this.db.select().from(nodeExecutions).where(eq(nodeExecutions.id, id)).get() ?? null;
  }

  updateNodeExecutionStatus(id: string, status: string, durationMs?: number): void {
    const finishedAt = ["completed", "failed", "skipped"].includes(status) ? Date.now() : undefined;
    this.db
      .update(nodeExecutions)
      .set({ status: status as any, finishedAt, durationMs })
      .where(eq(nodeExecutions.id, id))
      .run();
  }

  saveOutput(nodeExecutionId: string, content: string, exitCode?: number | null): string {
    const id = randomUUID();
    this.db
      .insert(outputs)
      .values({ id, nodeExecutionId, content, exitCode: exitCode ?? null })
      .run();
    return id;
  }

  getOutput(nodeExecutionId: string) {
    return (
      this.db.select().from(outputs).where(eq(outputs.nodeExecutionId, nodeExecutionId)).get() ??
      null
    );
  }

  recordEvent(runId: string, nodeId: string | null, type: string, payload?: string): string {
    const id = randomUUID();
    this.db
      .insert(events)
      .values({ id, runId, nodeId, type, payload: payload ?? null, timestamp: Date.now() })
      .run();
    return id;
  }

  getEvents(runId: string) {
    return this.db
      .select()
      .from(events)
      .where(eq(events.runId, runId))
      .orderBy(events.timestamp)
      .all();
  }

  getNodeOutputs(runId: string): Record<string, { output: string }> {
    const rows = this.db
      .select({
        nodeId: nodeExecutions.nodeId,
        content: outputs.content,
      })
      .from(nodeExecutions)
      .innerJoin(outputs, eq(outputs.nodeExecutionId, nodeExecutions.id))
      .where(and(eq(nodeExecutions.runId, runId), eq(nodeExecutions.status, "completed")))
      .orderBy(desc(nodeExecutions.finishedAt))
      .all();

    const result: Record<string, { output: string }> = {};
    for (const row of rows) {
      if (!result[row.nodeId]) {
        result[row.nodeId] = { output: row.content };
      }
    }
    return result;
  }
}
