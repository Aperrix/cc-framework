import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { cleanupToMakeRoom, listWorktrees } from "../../src/isolation/isolation.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

describe("cleanupToMakeRoom", () => {
  let repoDir: string;

  beforeEach(async () => {
    repoDir = await mkdtemp(join(tmpdir(), "ccf-cleanup-room-test-"));
    execSync("git init && git commit --allow-empty -m init", { cwd: repoDir });
  });

  afterEach(async () => {
    await rm(repoDir, { recursive: true, force: true });
  });

  it("returns 0 when worktree count is under the threshold", async () => {
    const removed = await cleanupToMakeRoom(repoDir, "ccf/", 10);
    expect(removed).toBe(0);
  });

  it("returns 0 when worktree count equals threshold minus one", async () => {
    // Create 2 worktrees, set threshold to 3
    for (let i = 0; i < 2; i++) {
      const wtPath = join(repoDir, `wt-${i}`);
      execSync(`git worktree add -b ccf/run-${i} "${wtPath}"`, { cwd: repoDir });
    }

    const removed = await cleanupToMakeRoom(repoDir, "ccf/", 3);
    expect(removed).toBe(0);

    // Cleanup
    for (let i = 0; i < 2; i++) {
      const wtPath = join(repoDir, `wt-${i}`);
      execSync(`git worktree remove "${wtPath}" --force`, { cwd: repoDir });
      execSync(`git branch -D ccf/run-${i}`, { cwd: repoDir });
    }
  });

  it("removes oldest worktrees when at or over the threshold", async () => {
    // Create 3 worktrees, set threshold to 3
    for (let i = 0; i < 3; i++) {
      const wtPath = join(repoDir, `wt-${i}`);
      execSync(`git worktree add -b ccf/run-${i} "${wtPath}"`, { cwd: repoDir });
    }

    const removed = await cleanupToMakeRoom(repoDir, "ccf/", 3);
    expect(removed).toBe(1);

    const remaining = await listWorktrees(repoDir, "ccf/");
    expect(remaining).toHaveLength(2);

    // Cleanup remaining
    for (const wt of remaining) {
      execSync(`git worktree remove "${wt.path}" --force`, { cwd: repoDir });
      execSync(`git branch -D "${wt.branch}"`, { cwd: repoDir });
    }
  });
});
