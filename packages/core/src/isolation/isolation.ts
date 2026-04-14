/** Git isolation strategies (worktree or branch) for running workflows in a clean environment. */

import { exec } from "node:child_process";
import { promisify } from "node:util";

import type { Isolation } from "../schema/common.ts";
import type { IsolationStrategy } from "../constants.ts";

const execAsync = promisify(exec);

/** Describes the isolation environment created for a run. */
export interface IsolationEnvironment {
  strategy: IsolationStrategy;
  branchName: string;
  worktreePath?: string;
  originalCwd: string;
  workingDirectory: string;
}

/**
 * Create an isolated git environment for a workflow run.
 *
 * - **worktree**: Creates a new git worktree + branch in a sibling directory,
 *   giving the run a fully independent working tree.
 * - **branch**: Creates a new branch in the current repo without moving files,
 *   lighter weight but shares the working directory.
 */
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

  // Branch strategy — create branch but stay in the same directory
  await execAsync(`git checkout -b "${branchName}"`, { cwd });
  return {
    strategy: "branch",
    branchName,
    originalCwd: cwd,
    workingDirectory: cwd,
  };
}

/** Remove a worktree and its branch. Branch-only isolation needs no cleanup. */
export async function cleanupIsolation(env: IsolationEnvironment): Promise<void> {
  if (env.strategy === "worktree") {
    await execAsync(`git worktree remove "${env.worktreePath}" --force`, {
      cwd: env.originalCwd,
    }).catch(() => {});
    await execAsync(`git branch -D "${env.branchName}"`, { cwd: env.originalCwd }).catch(() => {});
  }
}
