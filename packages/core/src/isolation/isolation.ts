import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Isolation } from "../schema/common.ts";

const execAsync = promisify(exec);

export interface IsolationEnvironment {
  strategy: "worktree" | "branch";
  branchName: string;
  worktreePath?: string;
  originalCwd: string;
  workingDirectory: string;
}

export async function setupIsolation(
  config: Isolation,
  runId: string,
  cwd: string,
): Promise<IsolationEnvironment> {
  const branchName = `${config.branch_prefix}${runId}`;

  if (config.strategy === "worktree") {
    const worktreePath = `${cwd}/../.cc-framework-worktrees/${runId}`;
    await execAsync(`git worktree add -b "${branchName}" "${worktreePath}"`, { cwd });
    return {
      strategy: "worktree",
      branchName,
      worktreePath,
      originalCwd: cwd,
      workingDirectory: worktreePath,
    };
  }

  // Branch strategy — create branch, stay in same directory
  await execAsync(`git checkout -b "${branchName}"`, { cwd });
  return {
    strategy: "branch",
    branchName,
    originalCwd: cwd,
    workingDirectory: cwd,
  };
}

export async function cleanupIsolation(env: IsolationEnvironment): Promise<void> {
  if (env.strategy === "worktree") {
    await execAsync(`git worktree remove "${env.worktreePath}" --force`, {
      cwd: env.originalCwd,
    }).catch(() => {});
    await execAsync(`git branch -D "${env.branchName}"`, { cwd: env.originalCwd }).catch(() => {});
  }
}
