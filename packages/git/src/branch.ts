/** Git branch operations. */

import { git, gitSafe } from "./exec.ts";

/** Get the default branch name (main or master). */
export async function getDefaultBranch(cwd: string): Promise<string> {
  // Try symbolic-ref first (works if remote is configured)
  const symbolic = await gitSafe(["symbolic-ref", "refs/remotes/origin/HEAD", "--short"], cwd);
  if (symbolic) return symbolic.replace("origin/", "");

  // Fall back to checking common names
  for (const name of ["main", "master"]) {
    const exists = await gitSafe(["rev-parse", "--verify", name], cwd);
    if (exists !== null) return name;
  }

  return "main";
}

/** Create and switch to a new branch. */
export async function createBranch(name: string, cwd: string): Promise<void> {
  await git(["checkout", "-b", name], cwd);
}

/** Check if a branch has been merged into the target branch. */
export async function isBranchMerged(branch: string, into: string, cwd: string): Promise<boolean> {
  const merged = await gitSafe(["branch", "--merged", into, "--list", branch], cwd);
  return merged !== null && merged.trim().length > 0;
}

/** Delete a local branch. Returns true if deleted, false if not found. */
export async function deleteBranch(name: string, cwd: string, force = false): Promise<boolean> {
  const flag = force ? "-D" : "-d";
  const result = await gitSafe(["branch", flag, name], cwd);
  return result !== null;
}

/** Check if the working tree has uncommitted changes. */
export async function hasUncommittedChanges(cwd: string): Promise<boolean> {
  const status = await git(["status", "--porcelain"], cwd);
  return status.length > 0;
}

/** Get the date of the last commit on a branch. */
export async function getLastCommitDate(branch: string, cwd: string): Promise<Date | null> {
  const timestamp = await gitSafe(["log", "-1", "--format=%cI", branch, "--"], cwd);
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Fetch from origin (non-destructive). */
export async function fetchOrigin(cwd: string): Promise<void> {
  await git(["fetch", "origin", "--prune"], cwd);
}

/** Check if the cwd is inside a git repository. */
export async function isGitRepo(cwd: string): Promise<boolean> {
  const result = await gitSafe(["rev-parse", "--is-inside-work-tree"], cwd);
  return result === "true";
}
