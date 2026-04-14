/** Strict Zod schema for Claude Code hook events on workflow nodes. */

import { z } from "zod";

export const HOOK_EVENTS = [
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "Notification",
  "UserPromptSubmit",
  "SessionStart",
  "SessionEnd",
  "Stop",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "PermissionRequest",
  "Setup",
  "TeammateIdle",
  "TaskCompleted",
  "Elicitation",
  "ElicitationResult",
  "ConfigChange",
  "WorktreeCreate",
  "WorktreeRemove",
  "InstructionsLoaded",
] as const;

export type HookEvent = (typeof HOOK_EVENTS)[number];

export const HookMatcherSchema = z.object({
  matcher: z.string().optional(),
  response: z.record(z.string(), z.unknown()),
  timeout: z.number().positive().optional(),
});

export type HookMatcher = z.infer<typeof HookMatcherSchema>;

/** Strict schema — rejects unknown event names (catches typos). */
export const NodeHooksSchema = z
  .object({
    PreToolUse: z.array(HookMatcherSchema).optional(),
    PostToolUse: z.array(HookMatcherSchema).optional(),
    PostToolUseFailure: z.array(HookMatcherSchema).optional(),
    Notification: z.array(HookMatcherSchema).optional(),
    UserPromptSubmit: z.array(HookMatcherSchema).optional(),
    SessionStart: z.array(HookMatcherSchema).optional(),
    SessionEnd: z.array(HookMatcherSchema).optional(),
    Stop: z.array(HookMatcherSchema).optional(),
    SubagentStart: z.array(HookMatcherSchema).optional(),
    SubagentStop: z.array(HookMatcherSchema).optional(),
    PreCompact: z.array(HookMatcherSchema).optional(),
    PermissionRequest: z.array(HookMatcherSchema).optional(),
    Setup: z.array(HookMatcherSchema).optional(),
    TeammateIdle: z.array(HookMatcherSchema).optional(),
    TaskCompleted: z.array(HookMatcherSchema).optional(),
    Elicitation: z.array(HookMatcherSchema).optional(),
    ElicitationResult: z.array(HookMatcherSchema).optional(),
    ConfigChange: z.array(HookMatcherSchema).optional(),
    WorktreeCreate: z.array(HookMatcherSchema).optional(),
    WorktreeRemove: z.array(HookMatcherSchema).optional(),
    InstructionsLoaded: z.array(HookMatcherSchema).optional(),
  })
  .strict();

export type NodeHooks = z.infer<typeof NodeHooksSchema>;
