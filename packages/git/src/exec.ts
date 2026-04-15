/** Low-level git command execution via execFile (not exec — avoids shell injection). */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Run a git command and return stdout. Throws on non-zero exit. */
export async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trimEnd();
}

/** Run a git command, returning stdout. Returns null on non-zero exit instead of throwing. */
export async function gitSafe(args: string[], cwd: string): Promise<string | null> {
  try {
    return await git(args, cwd);
  } catch {
    return null;
  }
}
