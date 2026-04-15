import { describe, test, expect, vi, beforeEach } from "vite-plus/test";

vi.mock("../src/exec.ts", () => ({
  git: vi.fn(),
  gitSafe: vi.fn(),
}));

import { git, gitSafe } from "../src/exec.ts";
import { addWorktree, removeWorktree, pruneWorktrees, listWorktrees } from "../src/worktree.ts";

const mockGit = vi.mocked(git);
const mockGitSafe = vi.mocked(gitSafe);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("addWorktree", () => {
  test("calls git with worktree add -b", async () => {
    mockGit.mockResolvedValueOnce("");

    await addWorktree("ccf/run-0", "/tmp/wt1", "/repo");
    expect(mockGit).toHaveBeenCalledWith(
      ["worktree", "add", "-b", "ccf/run-0", "/tmp/wt1"],
      "/repo",
    );
  });
});

describe("removeWorktree", () => {
  test("returns true on success", async () => {
    mockGitSafe.mockResolvedValueOnce("");

    const result = await removeWorktree("/tmp/wt1", "/repo");
    expect(result).toBe(true);
    expect(mockGitSafe).toHaveBeenCalledWith(
      ["worktree", "remove", "/tmp/wt1", "--force"],
      "/repo",
    );
  });

  test("returns false when gitSafe returns null", async () => {
    mockGitSafe.mockResolvedValueOnce(null);

    const result = await removeWorktree("/tmp/wt1", "/repo");
    expect(result).toBe(false);
  });
});

describe("pruneWorktrees", () => {
  test("calls gitSafe with worktree prune", async () => {
    mockGitSafe.mockResolvedValueOnce("");

    await pruneWorktrees("/repo");
    expect(mockGitSafe).toHaveBeenCalledWith(["worktree", "prune"], "/repo");
  });
});

describe("listWorktrees", () => {
  const porcelainOutput = [
    "worktree /home/user/project",
    "HEAD abc123",
    "branch refs/heads/main",
    "",
    "worktree /tmp/wt1",
    "HEAD def456",
    "branch refs/heads/ccf/run-0",
    "",
    "worktree /tmp/wt2",
    "HEAD 789abc",
    "branch refs/heads/ccf/run-1",
  ].join("\n");

  test("parses porcelain output and filters by default ccf/ prefix", async () => {
    mockGitSafe.mockResolvedValueOnce(porcelainOutput);

    const result = await listWorktrees("/repo");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ path: "/tmp/wt1", branch: "ccf/run-0", head: "def456" });
    expect(result[1]).toEqual({ path: "/tmp/wt2", branch: "ccf/run-1", head: "789abc" });
  });

  test("filters by custom branch prefix", async () => {
    const output = [
      "worktree /tmp/wt1",
      "HEAD def456",
      "branch refs/heads/custom/run-0",
      "",
      "worktree /tmp/wt2",
      "HEAD 789abc",
      "branch refs/heads/ccf/run-1",
    ].join("\n");
    mockGitSafe.mockResolvedValueOnce(output);

    const result = await listWorktrees("/repo", "custom/");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ path: "/tmp/wt1", branch: "custom/run-0", head: "def456" });
  });

  test("returns empty array when gitSafe returns null", async () => {
    mockGitSafe.mockResolvedValueOnce(null);

    const result = await listWorktrees("/repo");
    expect(result).toEqual([]);
  });

  test("handles entry without trailing newline", async () => {
    const output = ["worktree /tmp/wt1", "HEAD def456", "branch refs/heads/ccf/run-0"].join("\n");
    mockGitSafe.mockResolvedValueOnce(output);

    const result = await listWorktrees("/repo");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ path: "/tmp/wt1", branch: "ccf/run-0", head: "def456" });
  });
});
