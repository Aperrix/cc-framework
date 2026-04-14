/** Format tool calls for user-friendly display. */

/**
 * Format a tool call into a short, readable summary.
 *
 * @param toolName - Tool being called (e.g. "Bash", "Read", "Edit")
 * @param toolInput - Input parameters
 * @returns Formatted string like "BASH: git status" or "READ: src/index.ts"
 */
export function formatToolCall(toolName: string, toolInput?: Record<string, unknown>): string {
  let message = toolName.toUpperCase();

  if (toolInput) {
    const brief = extractBriefInfo(toolName, toolInput);
    if (brief) message += `: ${brief}`;
  }

  return message;
}

function extractBriefInfo(toolName: string, toolInput: Record<string, unknown>): string | null {
  const lower = toolName.toLowerCase();

  if (lower === "bash" && toolInput.command) {
    return truncate(String(toolInput.command), 80);
  }
  if ((lower === "read" || lower === "write" || lower === "edit") && toolInput.file_path) {
    return String(toolInput.file_path);
  }
  if (lower === "grep" && toolInput.pattern) {
    return `/${String(toolInput.pattern)}/`;
  }
  if (lower === "glob" && toolInput.pattern) {
    return String(toolInput.pattern);
  }

  return null;
}

function truncate(str: string, max: number): string {
  const firstLine = str.split("\n")[0];
  return firstLine.length > max ? `${firstLine.slice(0, max)}...` : firstLine;
}
