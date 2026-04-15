/** Variable substitution engine for prompt and script templates. */

interface NodeOutput {
  output: string;
}

/** Aliases that map one built-in name to another (e.g. $USER_MESSAGE -> $ARGUMENTS). */
/** Aliases that map alternative names to canonical builtins. */
const BUILTIN_ALIASES: Record<string, string> = {
  USER_MESSAGE: "ARGUMENTS",
  EXTERNAL_CONTEXT: "CONTEXT",
  LOOP_INPUT: "LOOP_USER_INPUT",
};

/**
 * Replace variable references in `text` using three substitution passes:
 *
 * 1. `$nodeId.output.field` — extract a JSON field from a node's output
 * 2. `$nodeId.output`       — inject the full output of a completed node
 * 3. `$BUILTIN`             — inject a built-in variable (e.g. $ARGUMENTS, $ARTIFACTS_DIR)
 *
 * Unresolvable references are left as-is so downstream tooling can surface them.
 */
export function substituteVariables(
  text: string,
  builtins: Record<string, string>,
  nodeOutputs: Record<string, NodeOutput> = {},
): string {
  const resolved: Record<string, string> = { ...builtins };
  for (const [alias, target] of Object.entries(BUILTIN_ALIASES)) {
    if (resolved[target] !== undefined) {
      resolved[alias] = resolved[target];
    }
  }

  let result = text;

  // Pass 1: $nodeId.output.field (JSON extraction) — must come before pass 2
  result = result.replace(/\$(\w+)\.output\.(\w+)/g, (match, nodeId: string, field: string) => {
    const node = nodeOutputs[nodeId];
    if (!node) return match;
    try {
      const parsed = JSON.parse(node.output);
      return parsed[field] !== undefined ? String(parsed[field]) : match;
    } catch {
      return match;
    }
  });

  // Pass 2: $nodeId.output (full output)
  result = result.replace(/\$(\w+)\.output(?!\.\w)/g, (match, nodeId: string) => {
    const node = nodeOutputs[nodeId];
    return node ? node.output : match;
  });

  // Pass 3: $BUILTIN variables (uppercase names only)
  result = result.replace(/\$([A-Z_]+)/g, (match, name: string) => {
    return resolved[name] !== undefined ? resolved[name] : match;
  });

  return result;
}
