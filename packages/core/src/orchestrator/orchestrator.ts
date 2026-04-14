/**
 * Orchestrator — receives user input, determines action, dispatches workflows.
 *
 * Main entry point for intelligent routing in cc-framework.
 * Combines deterministic command handling, fuzzy name matching, and optional
 * LLM-based intent classification.
 *
 * Adapted from Archon's orchestrator for cc-framework's CLI/MCP context.
 */

import type { ResolvedConfig } from "../config/types.ts";
import {
  discoverWorkflows,
  parseWorkflow,
  resolveWorkflowByName,
  WorkflowExecutor,
  WorkflowEventBus,
  type StoreQueries,
  type DiscoveredWorkflow,
  type WorkflowMatch,
} from "@cc-framework/workflows";
import { createLogger, toError, type Logger } from "@cc-framework/utils";
import { toWorkflowConfig } from "../store-adapter.ts";
import {
  shouldCreateNewSession,
  shouldDeactivateSession,
  detectPlanToExecuteTransition,
  type TransitionTrigger,
} from "../state/session-transitions.ts";

// Lazy logger
let cachedLog: Logger | undefined;
function getLog(): Logger {
  if (!cachedLog) cachedLog = createLogger("orchestrator");
  return cachedLog;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Context for orchestrator operations. */
export interface OrchestratorContext {
  config: ResolvedConfig;
  store: StoreQueries;
  sessionId: string;
  cwd: string;
  lastWorkflow?: string;
}

/** Result from handleMessage. */
export type HandleResult =
  | { type: "workflow_started"; runId: string; workflowName: string; status: string }
  | { type: "workflow_not_found"; message: string }
  | { type: "assist"; message: string }
  | { type: "command"; message: string }
  | { type: "error"; message: string };

// ---------------------------------------------------------------------------
// Session Management
// ---------------------------------------------------------------------------

/** Handle session transitions based on a trigger. */
export function handleSessionTransition(
  trigger: TransitionTrigger,
  store: StoreQueries,
  cwd: string,
): string {
  if (shouldDeactivateSession(trigger)) {
    // Deactivate by creating a new session (the old one is implicitly closed)
    getLog().info({ trigger }, "orchestrator.session_deactivated");
  }

  if (shouldCreateNewSession(trigger)) {
    const newSessionId = store.createSession(cwd);
    getLog().info({ trigger, sessionId: newSessionId }, "orchestrator.session_created");
    return newSessionId;
  }

  // For deactivating triggers that don't immediately create,
  // the next operation will create a new session
  const existing = store.getActiveSession(cwd);
  if (existing) return existing.id;

  const newSessionId = store.createSession(cwd);
  return newSessionId;
}

// ---------------------------------------------------------------------------
// Workflow Resolution
// ---------------------------------------------------------------------------

/** Try to resolve a workflow by name using fuzzy matching. */
export function resolveWorkflowFuzzy(
  name: string,
  discovered: readonly DiscoveredWorkflow[],
): WorkflowMatch | null {
  return resolveWorkflowByName(name, discovered);
}

// ---------------------------------------------------------------------------
// Workflow Dispatch
// ---------------------------------------------------------------------------

/** Parse and execute a discovered workflow. */
export async function dispatchWorkflow(
  discovered: DiscoveredWorkflow,
  args: string | undefined,
  ctx: OrchestratorContext,
): Promise<HandleResult> {
  const config = ctx.config;
  const workflow = await parseWorkflow(discovered.path, config);

  // Check for plan→execute transition
  const trigger = detectPlanToExecuteTransition(workflow.name, ctx.lastWorkflow);
  if (trigger) {
    ctx.sessionId = handleSessionTransition(trigger, ctx.store, ctx.cwd);
  }

  const eventBus = new WorkflowEventBus();
  const executor = new WorkflowExecutor(ctx.store, eventBus);

  getLog().info(
    { workflowName: workflow.name, sessionId: ctx.sessionId },
    "orchestrator.dispatching_workflow",
  );

  const result = await executor.run(workflow, ctx.cwd, args, config, ctx.sessionId);

  return {
    type: "workflow_started",
    runId: result.runId,
    workflowName: workflow.name,
    status: result.status,
  };
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Handle an incoming message — the orchestrator's main entry point.
 *
 * Purely deterministic routing:
 * 1. Discover available workflows
 * 2. Try fuzzy name match against the first word
 * 3. If no match, return the list of available workflows
 *
 * LLM-based routing is unnecessary — Claude Code (the caller) is already
 * the LLM that decides which workflow to invoke via MCP tools.
 */
export async function handleMessage(
  message: string,
  ctx: OrchestratorContext,
): Promise<HandleResult> {
  try {
    getLog().debug({ message: message.slice(0, 100) }, "orchestrator.message_received");

    const wfConfig = toWorkflowConfig(ctx.config);
    const discovered = await discoverWorkflows(wfConfig);

    if (discovered.length === 0) {
      return {
        type: "assist",
        message: "No workflows available. Create workflows in `.cc-framework/workflows/`.",
      };
    }

    // Try fuzzy name match — works when user types a workflow name directly
    const trimmed = message.trim();
    const firstWord = trimmed.split(/\s+/)[0];
    const fuzzyMatch = resolveWorkflowFuzzy(firstWord, discovered);

    if (fuzzyMatch) {
      const matched = discovered.find((d) => d.name === fuzzyMatch.name);
      if (matched) {
        const args = trimmed.slice(firstWord.length).trim() || undefined;
        return await dispatchWorkflow(matched, args, ctx);
      }
    }

    // No match — return available workflows for the caller (Claude Code) to choose
    const workflowNames = discovered.map((d) => d.name).join(", ");
    return {
      type: "assist",
      message: `No workflow matched. Available: ${workflowNames}`,
    };
  } catch (error) {
    const err = toError(error);
    getLog().error({ err }, "orchestrator.handle_message_failed");
    return {
      type: "error",
      message: `Orchestrator error: ${err.message}`,
    };
  }
}
