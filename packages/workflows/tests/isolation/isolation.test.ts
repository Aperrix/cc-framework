import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { listWorktrees, cleanupOrphanedWorktrees } from "../../src/isolation/isolation.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

describe("listWorktrees", () => {
  let repoDir: string;

  beforeEach(async () => {
    repoDir = await mkdtemp(join(tmpdir(), "ccf-isolation-test-"));
    execSync("git init && git commit --allow-empty -m init", { cwd: repoDir });
  });

  afterEach(async () => {
    await rm(repoDir, { recursive: true, force: true });
  });

  it("lists cc-framework worktrees by prefix", async () => {
    const wtPath = join(repoDir, "wt-test");
    execSync(`git worktree add -b ccf/test-run "${wtPath}"`, { cwd: repoDir });

    const worktrees = await listWorktrees(repoDir, "ccf/");
    expect(worktrees).toHaveLength(1);
    expect(worktrees[0].branch).toBe("ccf/test-run");

    // Cleanup
    execSync(`git worktree remove "${wtPath}" --force`, { cwd: repoDir });
    execSync("git branch -D ccf/test-run", { cwd: repoDir });
  });

  it("returns empty array in a repo with no worktrees", async () => {
    const worktrees = await listWorktrees(repoDir, "ccf/");
    expect(worktrees).toHaveLength(0);
  });
});

describe("cleanupOrphanedWorktrees", () => {
  let repoDir: string;

  beforeEach(async () => {
    repoDir = await mkdtemp(join(tmpdir(), "ccf-isolation-test-"));
    execSync("git init && git commit --allow-empty -m init", { cwd: repoDir });
  });

  afterEach(async () => {
    await rm(repoDir, { recursive: true, force: true });
  });

  it("returns 0 when there are no worktrees to clean", async () => {
    const cleaned = await cleanupOrphanedWorktrees(repoDir, "ccf/", "main");
    expect(cleaned).toBe(0);
  });

  it("cleans up a worktree whose directory has been manually removed", async () => {
    const wtPath = join(repoDir, "wt-orphan");
    execSync(`git worktree add -b ccf/orphan-run "${wtPath}"`, { cwd: repoDir });

    // Simulate orphan by removing the directory without `git worktree remove`
    await rm(wtPath, { recursive: true, force: true });

    const cleaned = await cleanupOrphanedWorktrees(repoDir, "ccf/", "main");
    expect(cleaned).toBe(1);

    // Verify the branch is gone
    const remaining = await listWorktrees(repoDir, "ccf/");
    expect(remaining).toHaveLength(0);
  });
});
