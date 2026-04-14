/** Zod schemas for workflow runtime state — source of truth for validation. */

import { z } from "zod";

import type { NodeExecutionStatus } from "../constants.ts";

// ---- Status Enums ----

export const WorkflowRunStatusSchema = z.enum([
  "pending",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
]);

export type WorkflowRunStatus = z.infer<typeof WorkflowRunStatusSchema>;

export const NodeExecutionStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
]);

export type NodeExecutionStatusZod = z.infer<typeof NodeExecutionStatusSchema>;

// ---- Node Output (discriminated union on `state`) ----

const NodeOutputCompletedSchema = z.object({
  state: z.literal("completed"),
  output: z.string(),
  sessionId: z.string().optional(),
});

const NodeOutputRunningSchema = z.object({
  state: z.literal("running"),
  output: z.string(),
  sessionId: z.string().optional(),
});

const NodeOutputFailedSchema = z.object({
  state: z.literal("failed"),
  output: z.string(),
  sessionId: z.string().optional(),
  error: z.string(),
});

const NodeOutputPendingSchema = z.object({
  state: z.literal("pending"),
  output: z.string(),
});

const NodeOutputSkippedSchema = z.object({
  state: z.literal("skipped"),
  output: z.string(),
});

export const NodeOutputSchema = z.discriminatedUnion("state", [
  NodeOutputCompletedSchema,
  NodeOutputRunningSchema,
  NodeOutputFailedSchema,
  NodeOutputPendingSchema,
  NodeOutputSkippedSchema,
]);

export type NodeOutput = z.infer<typeof NodeOutputSchema>;

// ---- Compile-time assertion: NodeOutput covers all NodeExecutionStatus values ----

type _AssertCovers = NodeOutput["state"] extends NodeExecutionStatus
  ? NodeExecutionStatus extends NodeOutput["state"]
    ? true
    : never
  : never;

// If this line errors, NodeOutput discriminants are out of sync with NodeExecutionStatus.
const _coverageCheck: _AssertCovers = true;
void _coverageCheck;

// ---- Approval Context ----

export const ApprovalContextSchema = z.object({
  nodeId: z.string(),
  message: z.string(),
  type: z.enum(["approval", "interactive_loop"]).optional(),
  iteration: z.number().optional(),
});

export type ApprovalContext = z.infer<typeof ApprovalContextSchema>;

/** Type guard to validate a value as an ApprovalContext. */
export function isApprovalContext(val: unknown): val is ApprovalContext {
  return ApprovalContextSchema.safeParse(val).success;
}

// ---- Artifact Types ----

export const ArtifactTypeSchema = z.enum([
  "pr",
  "commit",
  "file_created",
  "file_modified",
  "branch",
]);

export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;
