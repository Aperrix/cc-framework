/**
 * Git isolation strategies (worktree or branch) for running workflows in a clean environment.
 * Includes utilities for detecting and cleaning up orphaned/stale worktrees.
 */

import { existsSync } from "node:fs";
import { cp, stat } from "node:fs/promises";
import { resolve, join } from "node:path";

import {
  addWorktree,
  removeWorktree,
  pruneWorktrees,
  listWorktrees as gitListWorktrees,
  createBranch,
  deleteBranch,
  isBranchMerged,
  fetchOrigin,
  gitSafe,
  type WorktreeInfo,
} from "@cc-framework/git";
import type { Isolation } from "../schema/common.ts";
import type { IsolationStrategy } from "../constants.ts";

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
 * - **worktree**: Syncs with origin, then creates a new git worktree + branch.
 * - **branch**: Creates a new branch in the current repo without moving files.
 */
export async function setupIsolation(
  config: Isolation,
  runId: string,
  cwd: string,
): Promise<IsolationEnvironment> {
  const branchName = `${config.branch_prefix}${runId}`;

  if (config.strategy === "worktree") {
    // Validate runId to prevent path traversal
    if (/[/\\]|\.\./.test(runId)) {
      throw new Error(`Invalid runId for worktree: "${runId}"`);
    }

    // Sync with origin before creating worktree (best-effort)
    await fetchOrigin(cwd).catch(() => {});

    const worktreePath = resolve(cwd, "..", ".cc-framework-worktrees", runId);
    await addWorktree(branchName, worktreePath, cwd);

    // Sync project config into the worktree so workflows find prompts/scripts
    await syncConfigToWorktree(cwd, worktreePath);

    return {
      strategy: "worktree",
      branchName,
      worktreePath,
      originalCwd: cwd,
      workingDirectory: worktreePath,
    };
  }

  // Branch strategy — create branch but stay in the same directory
  await createBranch(branchName, cwd);
  return {
    strategy: "branch",
    branchName,
    originalCwd: cwd,
    workingDirectory: cwd,
  };
}

/** Remove a worktree and its branch. Branch-only isolation needs no cleanup. */
export async function cleanupIsolation(env: IsolationEnvironment): Promise<void> {
  if (env.strategy === "worktree" && env.worktreePath) {
    await removeWorktree(env.worktreePath, env.originalCwd);
    await deleteBranch(env.branchName, env.originalCwd, true);
  }
}

/**
 * Complete an isolation lifecycle — remove worktree, delete local and remote branches.
 * Use after a PR has been merged or work has been abandoned.
 */
export async function completeIsolation(
  env: IsolationEnvironment,
  deleteRemote = false,
): Promise<void> {
  if (env.strategy === "worktree" && env.worktreePath) {
    await removeWorktree(env.worktreePath, env.originalCwd);
  }
  await deleteBranch(env.branchName, env.originalCwd, true);
  if (deleteRemote) {
    await gitSafe(["push", "origin", "--delete", env.branchName], env.originalCwd);
  }
}

/**
 * Copy .cc-framework/ project config into a worktree so workflows
 * find prompts, scripts, and config. Best-effort — skips if source doesn't exist.
 */
async function syncConfigToWorktree(sourceCwd: string, worktreePath: string): Promise<void> {
  const sourceConfig = join(sourceCwd, ".cc-framework");
  try {
    await stat(sourceConfig);
    const targetConfig = join(worktreePath, ".cc-framework");
    await cp(sourceConfig, targetConfig, { recursive: true });
  } catch {
    // No .cc-framework/ in source — nothing to sync
  }
}

// ---- Listing & Cleanup ----

/**
 * List all cc-framework worktrees whose branches match the given prefix.
 */
export async function listWorktrees(
  cwd: string,
  branchPrefix: string = "ccf/",
): Promise<WorktreeInfo[]> {
  return gitListWorktrees(cwd, branchPrefix);
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
    const dirMissing = !existsSync(wt.path);
    const merged = !dirMissing && (await isBranchMerged(wt.branch, baseBranch, cwd));

    if (dirMissing || merged) {
      await removeWorktree(wt.path, cwd);
      await deleteBranch(wt.branch, cwd, true);
      cleaned++;
    }
  }

  await pruneWorktrees(cwd);
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

  const toRemove = worktrees.slice(0, worktrees.length - maxWorktrees + 1);
  let removed = 0;

  for (const wt of toRemove) {
    await removeWorktree(wt.path, cwd);
    await deleteBranch(wt.branch, cwd, true);
    removed++;
  }

  return removed;
}
