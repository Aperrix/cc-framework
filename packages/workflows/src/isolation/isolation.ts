/**
 * Git isolation strategies (worktree or branch) for running workflows in a clean environment.
 * Includes utilities for detecting and cleaning up orphaned/stale worktrees.
 */

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

// ---- Cleanup ----

/**
 * List all cc-framework worktrees whose branches match the given prefix.
 *
 * Parses `git worktree list --porcelain` output and returns path/branch pairs
 * for every worktree whose branch starts with `branchPrefix`.
 */
export async function listWorktrees(
  cwd: string,
  branchPrefix: string = "ccf/",
): Promise<{ path: string; branch: string }[]> {
  try {
    const { stdout } = await execAsync("git worktree list --porcelain", { cwd });
    const worktrees: { path: string; branch: string }[] = [];
    let currentPath = "";

    for (const line of stdout.split("\n")) {
      if (line.startsWith("worktree ")) {
        currentPath = line.slice("worktree ".length);
      } else if (line.startsWith("branch refs/heads/")) {
        const branch = line.slice("branch refs/heads/".length);
        if (branch.startsWith(branchPrefix) && currentPath) {
          worktrees.push({ path: currentPath, branch });
        }
      }
    }

    return worktrees;
  } catch {
    return [];
  }
}

/** Check if a worktree's branch has been merged into the base branch. */
async function isBranchMerged(
  cwd: string,
  branch: string,
  baseBranch: string = "main",
): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `git branch --merged "${baseBranch}" | grep -w "${branch}"`,
      { cwd },
    );
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Clean up orphaned and stale worktrees.
 *
 * A worktree is considered orphaned if:
 * - Its branch has been merged into the base branch
 * - Its directory no longer exists on disk
 *
 * Returns the number of worktrees cleaned up.
 */
export async function cleanupOrphanedWorktrees(
  cwd: string,
  branchPrefix: string = "ccf/",
  baseBranch: string = "main",
): Promise<number> {
  const worktrees = await listWorktrees(cwd, branchPrefix);
  let cleaned = 0;

  for (const wt of worktrees) {
    let shouldClean = false;

    // Check if the worktree directory still exists
    try {
      const { statSync } = await import("node:fs");
      statSync(wt.path);
    } catch {
      // Directory missing — orphaned
      shouldClean = true;
    }

    // Check if branch was merged
    if (!shouldClean) {
      shouldClean = await isBranchMerged(cwd, wt.branch, baseBranch);
    }

    if (shouldClean) {
      // Remove worktree (may fail if already gone — that's fine)
      await execAsync(`git worktree remove "${wt.path}" --force`, { cwd }).catch(() => {});
      await execAsync(`git branch -D "${wt.branch}"`, { cwd }).catch(() => {});
      cleaned++;
    }
  }

  // Prune any remaining stale worktree references
  await execAsync("git worktree prune", { cwd }).catch(() => {});

  return cleaned;
}

/** Maximum number of concurrent worktrees before cleanup kicks in. */
const MAX_WORKTREES = 10;

/**
 * Ensure there's room for a new worktree by cleaning up old ones.
 * Returns the number of worktrees removed.
 */
export async function cleanupToMakeRoom(
  cwd: string,
  branchPrefix: string = "ccf/",
  maxWorktrees: number = MAX_WORKTREES,
): Promise<number> {
  const worktrees = await listWorktrees(cwd, branchPrefix);
  if (worktrees.length < maxWorktrees) return 0;

  // Sort by path (oldest first — worktrees are created sequentially)
  const toRemove = worktrees.slice(0, worktrees.length - maxWorktrees + 1);
  let removed = 0;

  for (const wt of toRemove) {
    try {
      await cleanupIsolation({
        strategy: "worktree",
        branchName: wt.branch,
        worktreePath: wt.path,
        originalCwd: cwd,
        workingDirectory: wt.path,
      });
      removed++;
    } catch {
      // Best effort — skip worktrees that can't be removed
    }
  }

  return removed;
}
