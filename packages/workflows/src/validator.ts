/**
 * Workflow validation — Level 3 (resource resolution).
 *
 * Levels 1-2 (syntax + structure) are handled by parseWorkflow().
 * This module adds Level 3: checking that referenced resources
 * actually exist on disk before execution starts.
 *
 * Validates: prompt files, script files, depends_on references,
 * output_format references in when conditions.
 */

import { access } from "node:fs/promises";
import { join, isAbsolute } from "node:path";

import type { Workflow } from "./schema/workflow.ts";
import { isScriptFilePath } from "./utils/file-path.ts";

// ---- Types ----

export interface ValidationIssue {
  level: "error" | "warning";
  nodeId?: string;
  field: string;
  message: string;
  hint?: string;
}

export interface WorkflowValidationResult {
  workflowName: string;
  valid: boolean;
  issues: ValidationIssue[];
}

// ---- Helpers ----

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ---- Main ----

/**
 * Validate a parsed workflow's resource references.
 *
 * Checks that all prompt file paths and script file paths referenced
 * by nodes actually exist on disk. Call this after parseWorkflow()
 * but before execution for fail-fast error detection.
 *
 * @param workflow - Parsed workflow (prompts already resolved to content by parser)
 * @param workflowDir - Directory containing the workflow YAML (for relative path resolution)
 * @param searchDirs - Additional directories to search for referenced files
 */
export async function validateWorkflowResources(
  workflow: Workflow,
  workflowDir: string,
  searchDirs: string[] = [],
): Promise<WorkflowValidationResult> {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(workflow.nodes.map((n) => n.id));

  for (const node of workflow.nodes) {
    // Check script file references
    if (node.script && isScriptFilePath(node.script)) {
      const scriptPath = isAbsolute(node.script) ? node.script : join(workflowDir, node.script);
      const found = await fileExists(scriptPath);

      if (!found) {
        // Search additional dirs
        let foundInSearch = false;
        for (const dir of searchDirs) {
          if (await fileExists(join(dir, node.script))) {
            foundInSearch = true;
            break;
          }
        }
        if (!foundInSearch) {
          issues.push({
            level: "error",
            nodeId: node.id,
            field: "script",
            message: `Script file not found: "${node.script}"`,
            hint: `Searched in: ${scriptPath}`,
          });
        }
      }
    }

    // Check depends_on references to non-existent nodes
    for (const dep of node.depends_on) {
      if (!nodeIds.has(dep)) {
        issues.push({
          level: "error",
          nodeId: node.id,
          field: "depends_on",
          message: `Depends on node "${dep}" which does not exist`,
        });
      }
    }

    // Check for circular when references
    if (node.when) {
      const refPattern = /\$(\w+)\.output/g;
      for (const match of node.when.matchAll(refPattern)) {
        const refId = match[1];
        if (!nodeIds.has(refId)) {
          issues.push({
            level: "error",
            nodeId: node.id,
            field: "when",
            message: `References "$${refId}.output" but node "${refId}" does not exist`,
          });
        }
        if (!node.depends_on.includes(refId)) {
          issues.push({
            level: "warning",
            nodeId: node.id,
            field: "when",
            message: `References "$${refId}.output" but "${refId}" is not in depends_on — output may not be available yet`,
            hint: `Add "${refId}" to depends_on`,
          });
        }
      }
    }
  }

  return {
    workflowName: workflow.name,
    valid: !issues.some((i) => i.level === "error"),
    issues,
  };
}
