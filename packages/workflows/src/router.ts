/**
 * Workflow name resolution and invocation parsing.
 *
 * Provides fuzzy workflow name matching (4-tier hierarchy) and
 * parsing of /invoke-workflow commands from LLM output.
 *
 * LLM-based intent routing (building the prompt, calling the LLM)
 * belongs in the orchestrator layer — this module handles only
 * deterministic name resolution.
 */

import type { Workflow } from "./schema/workflow.ts";

// ---- Types ----

export interface WorkflowInvocation {
  workflowName: string | null;
  remainingMessage: string;
  error?: string;
}

export interface WorkflowMatch {
  name: string;
  tier: "exact" | "case_insensitive" | "suffix" | "substring";
}

// ---- Name Resolution ----

/**
 * Resolve a workflow by name using a 4-tier fallback hierarchy:
 * 1. Exact match
 * 2. Case-insensitive match
 * 3. Suffix match (e.g. "issue" matches "fix-issue")
 * 4. Substring match (e.g. "review" matches "comprehensive-review")
 *
 * Returns null if no match or if multiple ambiguous matches are found at the same tier.
 */
export function resolveWorkflowByName(
  name: string,
  workflows: readonly { name: string }[],
): WorkflowMatch | null {
  // Tier 1: Exact match
  const exact = workflows.find((w) => w.name === name);
  if (exact) return { name: exact.name, tier: "exact" };

  const lowerName = name.toLowerCase();

  // Tier 2: Case-insensitive match
  const caseMatch = workflows.filter((w) => w.name.toLowerCase() === lowerName);
  if (caseMatch.length === 1) return { name: caseMatch[0].name, tier: "case_insensitive" };

  // Tier 3: Suffix match
  const suffixMatch = workflows.filter((w) => w.name.toLowerCase().endsWith(`-${lowerName}`));
  if (suffixMatch.length === 1) return { name: suffixMatch[0].name, tier: "suffix" };

  // Tier 4: Substring match
  const subMatch = workflows.filter((w) => w.name.toLowerCase().includes(lowerName));
  if (subMatch.length === 1) return { name: subMatch[0].name, tier: "substring" };

  return null;
}

// ---- Invocation Parsing ----

/**
 * Parse a message to detect /invoke-workflow command.
 * Used when an LLM-based router outputs its workflow selection.
 *
 * Uses multiline matching because LLM models sometimes add analysis
 * text before the command despite instructions to only output the command.
 */
export function parseWorkflowInvocation(
  message: string,
  workflowNames: readonly string[],
): WorkflowInvocation {
  const trimmed = message.trim();

  const match = /^\/invoke-workflow\s+(\S+)/im.exec(trimmed);

  if (match) {
    const workflowName = match[1];

    // Exact match
    if (workflowNames.includes(workflowName)) {
      const remainingMessage = trimmed.slice(match.index + match[0].length).trim();
      return { workflowName, remainingMessage };
    }

    // Case-insensitive match
    const caseMatch = workflowNames.find((n) => n.toLowerCase() === workflowName.toLowerCase());
    if (caseMatch) {
      const remainingMessage = trimmed.slice(match.index + match[0].length).trim();
      return { workflowName: caseMatch, remainingMessage };
    }

    return {
      workflowName: null,
      remainingMessage: message,
      error: `Unknown workflow: "${workflowName}". Available: ${workflowNames.join(", ")}`,
    };
  }

  return { workflowName: null, remainingMessage: message };
}
