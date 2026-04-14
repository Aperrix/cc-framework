import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ScriptRuntime } from "../constants.ts";

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT = 120_000; // 2 minutes

export interface ScriptResult {
  output: string;
  exitCode: number;
}

function isFilePath(value: string): boolean {
  return (
    value.endsWith(".sh") ||
    value.endsWith(".ts") ||
    value.endsWith(".py") ||
    value.startsWith("./") ||
    value.startsWith("/")
  );
}

export async function runScript(
  script: string,
  cwd: string,
  runtime: ScriptRuntime = "bash",
  deps?: string[],
  timeout?: number,
): Promise<ScriptResult> {
  const effectiveTimeout = timeout ?? DEFAULT_TIMEOUT;
  const isFile = isFilePath(script);

  let cmd: string;
  let args: string[];

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
