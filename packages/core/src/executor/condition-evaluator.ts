/** Evaluates `when:` condition expressions and trigger rules against node outputs.
 *
 * Supports: ==, !=, >, >=, <, <= operators.
 * Handles && (AND) and || (OR) with && binding tighter.
 * Properly handles quoted values containing special characters.
 */

import type { TriggerRule } from "../constants.ts";

// ---- Types ----

type NodeOutputs = Record<string, { output: string }>;

interface NodeStatus {
  completed: boolean;
  failed: boolean;
  skipped: boolean;
}

// ---- Tokenizer ----

/**
 * Split a string by a delimiter, but only outside of single quotes.
 * Prevents splitting on delimiters inside quoted values.
 * e.g., splitOutsideQuotes("a == 'x||y' || b == 'z'", "||") -> ["a == 'x||y'", "b == 'z'"]
 */
export function splitOutsideQuotes(input: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuote = false;
  let i = 0;

  while (i < input.length) {
    if (input[i] === "'" && (i === 0 || input[i - 1] !== "\\")) {
      inQuote = !inQuote;
      current += input[i];
      i++;
    } else if (!inQuote && input.substring(i, i + delimiter.length) === delimiter) {
      parts.push(current.trim());
      current = "";
      i += delimiter.length;
    } else {
      current += input[i];
      i++;
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

// ---- Output Resolution ----

/**
 * Resolve a `$nodeId.output` or `$nodeId.output.field` reference.
 * Returns the string value, or undefined if the reference can't be resolved.
 */
export function resolveOutputRef(ref: string, nodeOutputs: NodeOutputs): string | undefined {
  const match = ref.match(/^\$(\w+)\.output(?:\.(\w+))?$/);
  if (!match) return undefined;

  const [, nodeId, field] = match;
  const node = nodeOutputs[nodeId];
  if (!node) return undefined;

  if (field) {
    try {
      const parsed = JSON.parse(node.output);
      return parsed[field] !== undefined ? String(parsed[field]) : undefined;
    } catch {
      return undefined;
    }
  }

  return node.output.trim();
}

// ---- Atom Evaluation ----

/**
 * Evaluate a single atomic condition: `$nodeId.output[.field] OP 'value'`
 */
export function evaluateAtom(atom: string, nodeOutputs: NodeOutputs): boolean {
  const match = atom.match(/^(\$\w+\.output(?:\.\w+)?)\s*(==|!=|>=?|<=?)\s*'([^']*)'$/);
  if (!match) return false;

  const [, ref, operator, expected] = match;
  const actual = resolveOutputRef(ref, nodeOutputs);
  if (actual === undefined) return false;

  switch (operator) {
    case "==":
      return actual === expected;
    case "!=":
      return actual !== expected;
    case ">":
      return Number(actual) > Number(expected);
    case ">=":
      return Number(actual) >= Number(expected);
    case "<":
      return Number(actual) < Number(expected);
    case "<=":
      return Number(actual) <= Number(expected);
    default:
      return false;
  }
}

// ---- Condition Evaluation ----

/**
 * Evaluate a `when:` condition string against collected node outputs.
 *
 * Supports compound conditions with && (higher precedence) and ||.
 * Properly handles quoted values containing || or && characters.
 * Returns false for invalid/unparseable expressions.
 */
export function evaluateCondition(condition: string, nodeOutputs: NodeOutputs): boolean {
  try {
    // Split by || first (lower precedence), respecting quotes
    const orGroups = splitOutsideQuotes(condition, "||");
    return orGroups.some((group) => {
      // Then split by && (higher precedence), respecting quotes
      const andClauses = splitOutsideQuotes(group, "&&");
      return andClauses.every((clause) => evaluateAtom(clause.trim(), nodeOutputs));
    });
  } catch {
    return false;
  }
}

// ---- Trigger Rules ----

/**
 * Check whether a node's trigger rule is satisfied given the status of its dependencies.
 * Returns true if the node should execute, false if it should be skipped.
 */
export function checkTriggerRule(rule: TriggerRule, dependencyStatuses: NodeStatus[]): boolean {
  if (dependencyStatuses.length === 0) return true;

  const succeeded = dependencyStatuses.filter((d) => d.completed).length;
  const failed = dependencyStatuses.filter((d) => d.failed).length;

  switch (rule) {
    case "all_success":
      return failed === 0 && succeeded === dependencyStatuses.length;
    case "one_success":
      return succeeded >= 1;
    case "none_failed_min_one_success":
      return failed === 0 && succeeded >= 1;
    case "all_done":
      return dependencyStatuses.every((d) => d.completed || d.failed || d.skipped);
    default:
      return true;
  }
}
