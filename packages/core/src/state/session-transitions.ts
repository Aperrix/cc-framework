/**
 * Session transition triggers — single source of truth for what causes session changes.
 *
 * Adapted from Archon's session-transitions for cc-framework's CLI/MCP context.
 * No platform conversations — sessions are tied to cwd.
 *
 * Adding a new trigger:
 * 1. Add to TransitionTrigger type
 * 2. Add to TRIGGER_BEHAVIOR with appropriate category
 * 3. Update detectPlanToExecuteTransition() if it can be auto-detected
 * 4. Update getTriggerForCommand() if it maps to a CLI command
 */

export type TransitionTrigger =
  | "first-message"
  | "plan-to-execute"
  | "isolation-changed"
  | "reset-requested"
  | "worktree-removed";

/**
 * Behavior category for each trigger.
 * - 'creates': Deactivates current session AND immediately creates a new one
 * - 'deactivates': Only deactivates current session (next command creates new one)
 * - 'none': Neither (first-message has no existing session to deactivate)
 *
 * This Record type ensures compile-time exhaustiveness — adding a new trigger
 * without categorizing it causes a TypeScript error.
 */
const TRIGGER_BEHAVIOR: Record<TransitionTrigger, "creates" | "deactivates" | "none"> = {
  "first-message": "none",
  "plan-to-execute": "creates",
  "isolation-changed": "deactivates",
  "reset-requested": "deactivates",
  "worktree-removed": "deactivates",
};

/** Determine if this trigger should create a new session immediately. */
export function shouldCreateNewSession(trigger: TransitionTrigger): boolean {
  return TRIGGER_BEHAVIOR[trigger] === "creates";
}

/** Determine if this trigger should deactivate the current session. */
export function shouldDeactivateSession(trigger: TransitionTrigger): boolean {
  return TRIGGER_BEHAVIOR[trigger] !== "none";
}

/**
 * Detect plan→execute transition from workflow context.
 * Returns 'plan-to-execute' if the current workflow follows a planning workflow.
 */
export function detectPlanToExecuteTransition(
  workflowName: string | undefined | null,
  lastWorkflow: string | undefined | null,
): TransitionTrigger | null {
  if (!workflowName || !lastWorkflow) return null;

  const planWorkflows = ["feature", "review"];
  const executeWorkflows = ["fix-issue", "refactor"];

  if (executeWorkflows.includes(workflowName) && planWorkflows.includes(lastWorkflow)) {
    return "plan-to-execute";
  }
  return null;
}

/** Commands that have known trigger mappings. */
export type DeactivatingCommand = "reset" | "worktree-remove";

const COMMAND_TRIGGER_MAP: Record<DeactivatingCommand, TransitionTrigger> = {
  reset: "reset-requested",
  "worktree-remove": "worktree-removed",
};

/**
 * Map command names to their transition triggers.
 * Known commands (DeactivatingCommand) return non-null.
 * Unknown commands return null.
 */
function isDeactivatingCommand(command: string): command is DeactivatingCommand {
  return command in COMMAND_TRIGGER_MAP;
}

export function getTriggerForCommand(command: DeactivatingCommand): TransitionTrigger;
export function getTriggerForCommand(command: string): TransitionTrigger | null;
export function getTriggerForCommand(command: string): TransitionTrigger | null {
  if (isDeactivatingCommand(command)) return COMMAND_TRIGGER_MAP[command];
  return null;
}
