/** Git worktree operations. */

import { git, gitSafe } from "./exec.ts";

/** Parsed worktree entry from `git worktree list --porcelain`. */
export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

/** Create a new worktree with a new branch. */
export async function addWorktree(
  branchName: string,
  worktreePath: string,
  cwd: string,
): Promise<void> {
  await git(["worktree", "add", "-b", branchName, worktreePath], cwd);
}

/** Remove a worktree by path. */
export async function removeWorktree(worktreePath: string, cwd: string): Promise<boolean> {
  const result = await gitSafe(["worktree", "remove", worktreePath, "--force"], cwd);
  return result !== null;
}

/** Prune stale worktree references. */
export async function pruneWorktrees(cwd: string): Promise<void> {
  await gitSafe(["worktree", "prune"], cwd);
}

/**
 * List all worktrees whose branch matches the given prefix.
 * Parses `git worktree list --porcelain` output.
 */
export async function listWorktrees(
  cwd: string,
  branchPrefix: string = "ccf/",
): Promise<WorktreeInfo[]> {
  const output = await gitSafe(["worktree", "list", "--porcelain"], cwd);
  if (!output) return [];

  const worktrees: WorktreeInfo[] = [];
  let currentPath = "";
  let currentHead = "";
  let currentBranch = "";

  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      currentPath = line.slice("worktree ".length);
    } else if (line.startsWith("HEAD ")) {
      currentHead = line.slice("HEAD ".length);
    } else if (line.startsWith("branch ")) {
      currentBranch = line.slice("branch refs/heads/".length);
    } else if (line === "" && currentPath && currentBranch) {
      if (currentBranch.startsWith(branchPrefix)) {
        worktrees.push({ path: currentPath, branch: currentBranch, head: currentHead });
      }
      currentPath = "";
      currentHead = "";
      currentBranch = "";
    }
  }

  // Handle last entry (no trailing newline)
  if (currentPath && currentBranch && currentBranch.startsWith(branchPrefix)) {
    worktrees.push({ path: currentPath, branch: currentBranch, head: currentHead });
  }

  return worktrees;
}
