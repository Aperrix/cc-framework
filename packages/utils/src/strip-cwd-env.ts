/**
 * Strip environment variables that leak into cc-framework subprocesses.
 *
 * Two concerns:
 * 1. Claude Code session markers (CLAUDECODE, CLAUDE_CODE_SSE_PORT, etc.)
 *    cause nested session deadlocks.
 * 2. Debugger vars (NODE_OPTIONS, VSCODE_INSPECTOR_OPTIONS) crash
 *    Claude Code subprocesses.
 *
 * Auth-related Claude Code vars are preserved so subprocesses can authenticate.
 */

const CLAUDE_CODE_AUTH_VARS = new Set([
  "CLAUDE_CODE_OAUTH_TOKEN",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
]);

/**
 * Remove Claude Code session markers and debugger variables from `process.env`.
 * Keeps auth-related vars (CLAUDE_CODE_OAUTH_TOKEN, etc.).
 */
export function stripClaudeCodeMarkers(): void {
  for (const key of Object.keys(process.env)) {
    if (
      key === "CLAUDECODE" ||
      (key.startsWith("CLAUDE_CODE_") && !CLAUDE_CODE_AUTH_VARS.has(key))
    ) {
      delete process.env[key];
    }
  }
  // Strip debugger vars that crash Claude Code subprocesses
  delete process.env.NODE_OPTIONS;
  delete process.env.VSCODE_INSPECTOR_OPTIONS;
}
