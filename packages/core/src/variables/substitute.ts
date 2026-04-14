interface NodeOutput {
  output: string;
}

const BUILTIN_ALIASES: Record<string, string> = {
  USER_MESSAGE: "ARGUMENTS",
};

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

  // Replace $nodeId.output.field (JSON extraction) — must come before $nodeId.output
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

  // Replace $nodeId.output (full output)
  result = result.replace(/\$(\w+)\.output(?!\.\w)/g, (match, nodeId: string) => {
    const node = nodeOutputs[nodeId];
    return node ? node.output : match;
  });

  // Replace $BUILTIN variables
  result = result.replace(/\$([A-Z_]+)/g, (match, name: string) => {
    return resolved[name] !== undefined ? resolved[name] : match;
  });

  return result;
}
