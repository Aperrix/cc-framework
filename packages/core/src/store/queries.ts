/** Query layer over the cc-framework SQLite store, grouped by domain. */

import { randomUUID } from "node:crypto";

import { eq, and, desc } from "drizzle-orm";

import type { Database } from "./database.ts";
import type { RunStatus, NodeExecutionStatus, WorkflowSource } from "../constants.ts";
import { TERMINAL_RUN_STATUSES, TERMINAL_NODE_STATUSES } from "../constants.ts";
import type { ApprovalContext } from "../runners/approval-runner.ts";
import { workflows, runs, nodeExecutions, outputs, events } from "./database.ts";

// ---- Workflow Operations ----

export class StoreQueries {
  constructor(private db: Database) {}

  /** Insert a new workflow or update the hash/source of an existing one (by name). */
  upsertWorkflow(name: string, source: WorkflowSource, yamlHash: string): string {
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

  /** Fetch a workflow record by ID, or null if not found. */
  getWorkflow(id: string) {
    return this.db.select().from(workflows).where(eq(workflows.id, id)).get() ?? null;
  }

  // ---- Run Operations ----

  /** Create a new run in "pending" status for the given workflow. */
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

  /** Fetch a run record by ID, or null if not found. */
  getRun(id: string) {
    return this.db.select().from(runs).where(eq(runs.id, id)).get() ?? null;
  }

  /** Transition a run to a new status, setting finishedAt for terminal states. */
  updateRunStatus(id: string, status: RunStatus): void {
    const finishedAt = (TERMINAL_RUN_STATUSES as readonly string[]).includes(status)
      ? Date.now()
      : undefined;
    this.db.update(runs).set({ status, finishedAt }).where(eq(runs.id, id)).run();
  }

  /** Get just the status column for a run, or null if not found. */
  getRunStatus(id: string): RunStatus | null {
    const run = this.db.select({ status: runs.status }).from(runs).where(eq(runs.id, id)).get();
    return (run?.status as RunStatus) ?? null;
  }

  // ---- Node Execution Operations ----

  /** Create a node execution record in "pending" status. */
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

  /** Fetch a node execution record by ID, or null if not found. */
  getNodeExecution(id: string) {
    return this.db.select().from(nodeExecutions).where(eq(nodeExecutions.id, id)).get() ?? null;
  }

  /** Transition a node execution to a new status, setting finishedAt for terminal states. */
  updateNodeExecutionStatus(id: string, status: NodeExecutionStatus, durationMs?: number): void {
    const finishedAt = (TERMINAL_NODE_STATUSES as readonly string[]).includes(status)
      ? Date.now()
      : undefined;
    this.db
      .update(nodeExecutions)
      .set({ status, finishedAt, durationMs })
      .where(eq(nodeExecutions.id, id))
      .run();
  }

  /** Persist a node's output content and optional exit code. */
  saveOutput(nodeExecutionId: string, content: string, exitCode?: number | null): string {
    const id = randomUUID();
    this.db
      .insert(outputs)
      .values({ id, nodeExecutionId, content, exitCode: exitCode ?? null })
      .run();
    return id;
  }

  /** Fetch the output for a node execution, or null if none recorded. */
  getOutput(nodeExecutionId: string) {
    return (
      this.db.select().from(outputs).where(eq(outputs.nodeExecutionId, nodeExecutionId)).get() ??
      null
    );
  }

  /**
   * Collect the latest completed output for every node in a run.
   * Used to build the variable substitution context for downstream nodes.
   */
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
      // Keep the first (most recent) output per node
      if (!result[row.nodeId]) {
        result[row.nodeId] = { output: row.content };
      }
    }
    return result;
  }

  // ---- Event Operations ----

  /** Record a timestamped event for a run (optionally scoped to a node). */
  recordEvent(runId: string, nodeId: string | null, type: string, payload?: string): string {
    const id = randomUUID();
    this.db
      .insert(events)
      .values({ id, runId, nodeId, type, payload: payload ?? null, timestamp: Date.now() })
      .run();
    return id;
  }

  /** Fetch all events for a run, ordered chronologically. */
  getEvents(runId: string) {
    return this.db
      .select()
      .from(events)
      .where(eq(events.runId, runId))
      .orderBy(events.timestamp)
      .all();
  }

  // ---- Approval Operations ----

  /** Pause a run and persist the approval context as an event payload. */
  pauseRun(id: string, approvalContext: ApprovalContext): void {
    this.db
      .update(runs)
      .set({ status: "paused" satisfies RunStatus })
      .where(eq(runs.id, id))
      .run();

    this.recordEvent(id, null, "approval:paused", JSON.stringify(approvalContext));
  }

  /** Retrieve the most recent approval context for a paused run, or null. */
  getApprovalContext(runId: string): Record<string, unknown> | null {
    const event = this.db
      .select()
      .from(events)
      .where(and(eq(events.runId, runId), eq(events.type, "approval:paused")))
      .orderBy(desc(events.timestamp))
      .get();

    if (!event?.payload) return null;
    try {
      return JSON.parse(event.payload);
    } catch {
      return null;
    }
  }

  /** Resume a paused run by setting its status back to "running". */
  resumeRun(id: string): void {
    this.db
      .update(runs)
      .set({ status: "running" satisfies RunStatus })
      .where(eq(runs.id, id))
      .run();
  }
}
