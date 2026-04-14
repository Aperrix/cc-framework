/** Utilities for detecting whether a string value is a file path vs inline content. */

/** File extensions that indicate a prompt file. */
const PROMPT_EXTENSIONS = [".md"];

/** File extensions that indicate a script file. */
const SCRIPT_EXTENSIONS = [".sh", ".ts", ".py", ".bash", ".js"];

/**
 * Check if a value looks like a file path rather than inline content.
 * Detects by file extension or path prefix (./ or /).
 */
export function isFilePath(
  value: string,
  extensions: readonly string[] = PROMPT_EXTENSIONS,
): boolean {
  if (value.startsWith("./") || value.startsWith("/")) return true;
  return extensions.some((ext) => value.endsWith(ext));
}

/** Check if a value is a prompt file path (.md extension or path prefix). */
export function isPromptFilePath(value: string): boolean {
  return isFilePath(value, PROMPT_EXTENSIONS);
}

/** Check if a value is a script file path (.sh/.ts/.py/.bash/.js extension or path prefix). */
export function isScriptFilePath(value: string): boolean {
  return isFilePath(value, SCRIPT_EXTENSIONS);
}
