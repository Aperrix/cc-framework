/**
 * Prompt builder — formats workflow metadata for display and MCP tool descriptions.
 *
 * Note: cc-framework does NOT need LLM-based routing prompts because Claude Code
 * (the host LLM) already decides which workflow to invoke via MCP tools.
 * This module provides formatting helpers for workflow listings.
 */

import type { Workflow } from "@cc-framework/workflows";

/** Format a list of workflows as a readable section (for CLI output or MCP tool descriptions). */
export function formatWorkflowSection(workflows: readonly Workflow[]): string {
  if (workflows.length === 0) {
    return "No workflows available. Create workflows in `.cc-framework/workflows/` as YAML files.\n";
  }

  let section = "";
  for (const w of workflows) {
    section += `**${w.name}**\n`;
    section += `  ${w.description ?? "No description"}\n`;
    section += `  Nodes: ${String(w.nodes.length)}\n`;
    section += "\n";
  }
  return section;
}

/**
 * Build a routing prompt listing available workflows.
 * Used by the startup prompt to inform Claude Code about available workflows.
 */
export function buildRoutingPrompt(workflows: readonly Workflow[], _userMessage: string): string {
  return `## Available Workflows\n\n${formatWorkflowSection(workflows)}`;
}
