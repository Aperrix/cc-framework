/** ccf complete <branchName> — remove worktree + delete local/remote branches after merge. */

import { completeIsolation } from "@cc-framework/workflows";

export async function commandComplete(
  branchName: string,
  cwd: string,
  deleteRemote = false,
): Promise<string> {
  await completeIsolation(
    {
      strategy: "worktree",
      branchName,
      originalCwd: cwd,
      workingDirectory: cwd,
    },
    deleteRemote,
  );
  return `Completed branch "${branchName}".${deleteRemote ? " Remote branch deleted." : ""}`;
}
