/** Executes script nodes via bash, bun, or uv (Python) runtimes. */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ScriptRuntime } from "../constants.ts";
import { isScriptFilePath } from "../utils/file-path.ts";

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT = 120_000; // 2 minutes

// ---- Interfaces ----

/** Result returned from a script execution, including combined stdout+stderr. */
export interface ScriptResult {
  output: string;
  exitCode: number;
}

// ---- Main ----

/** Run a script string or file using the specified runtime and return its output. */
export async function runScript(
  script: string,
  cwd: string,
  runtime: ScriptRuntime = "bash",
  deps?: string[],
  timeout?: number,
): Promise<ScriptResult> {
  const effectiveTimeout = timeout ?? DEFAULT_TIMEOUT;
  const isFile = isScriptFilePath(script);

  let cmd: string;
  let args: string[];

  // Dispatch to the appropriate runtime CLI
  switch (runtime) {
    case "bash":
      cmd = "bash";
      args = isFile ? [script] : ["-c", script];
      break;
    case "bun":
      cmd = "bun";
      args = isFile ? ["run", script] : ["-e", script];
      break;
    case "uv": {
      cmd = "uv";
      // uv uses --with flags to inject inline dependencies
      const depFlags = (deps ?? []).flatMap((d) => ["--with", d]);
      args = isFile ? ["run", ...depFlags, script] : ["run", ...depFlags, "python", "-c", script];
      break;
    }
  }

  try {
    const result = await execFileAsync(cmd, args, {
      cwd,
      timeout: effectiveTimeout,
      env: { ...process.env },
    });
    const output = result.stdout + result.stderr;
    return { output, exitCode: 0 };
  } catch (error: any) {
    const stdout = error.stdout ?? "";
    const stderr = error.stderr ?? "";
    const output = stdout + stderr;
    const exitCode = typeof error.code === "number" ? error.code : 1;
    return { output, exitCode };
  }
}
