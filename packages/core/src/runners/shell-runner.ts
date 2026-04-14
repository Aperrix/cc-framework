import { exec } from "node:child_process";

export interface ShellResult {
  output: string;
  exitCode: number;
}

export function runShell(command: string, cwd: string): Promise<ShellResult> {
  return new Promise((resolve) => {
    exec(command, { cwd, shell: "/bin/bash" }, (error, stdout, stderr) => {
      const output = stdout + stderr;
      const exitCode = error?.code ?? 0;
      resolve({ output, exitCode: typeof exitCode === "number" ? exitCode : 1 });
    });
  });
}
