/** @cc-framework/git — Git operations for workflow isolation and branch management. */

export { git, gitSafe } from "./exec.ts";

export {
  getDefaultBranch,
  createBranch,
  isBranchMerged,
  deleteBranch,
  hasUncommittedChanges,
  getLastCommitDate,
  fetchOrigin,
  isGitRepo,
} from "./branch.ts";

export {
  addWorktree,
  removeWorktree,
  pruneWorktrees,
  listWorktrees,
  type WorktreeInfo,
} from "./worktree.ts";
