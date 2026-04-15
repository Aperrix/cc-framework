import { describe, test, expect, vi, beforeEach } from "vite-plus/test";

vi.mock("../src/exec.ts", () => ({
  git: vi.fn(),
  gitSafe: vi.fn(),
}));

import { git, gitSafe } from "../src/exec.ts";
import {
  getDefaultBranch,
  createBranch,
  isBranchMerged,
  deleteBranch,
  hasUncommittedChanges,
  getLastCommitDate,
  fetchOrigin,
  isGitRepo,
} from "../src/branch.ts";

const mockGit = vi.mocked(git);
const mockGitSafe = vi.mocked(gitSafe);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getDefaultBranch", () => {
  test("returns branch from symbolic-ref when available", async () => {
    mockGitSafe.mockResolvedValueOnce("origin/main");

    const result = await getDefaultBranch("/repo");
    expect(result).toBe("main");
    expect(mockGitSafe).toHaveBeenCalledWith(
      ["symbolic-ref", "refs/remotes/origin/HEAD", "--short"],
      "/repo",
    );
  });

  test("falls back to rev-parse when symbolic-ref fails", async () => {
    mockGitSafe.mockResolvedValueOnce(null); // symbolic-ref fails
    mockGitSafe.mockResolvedValueOnce("abc123"); // rev-parse main succeeds

    const result = await getDefaultBranch("/repo");
    expect(result).toBe("main");
    expect(mockGitSafe).toHaveBeenCalledWith(["rev-parse", "--verify", "main"], "/repo");
  });

  test("returns 'main' as default when all checks fail", async () => {
    mockGitSafe.mockResolvedValue(null);

    const result = await getDefaultBranch("/repo");
    expect(result).toBe("main");
  });
});

describe("createBranch", () => {
  test("calls git with checkout -b", async () => {
    mockGit.mockResolvedValueOnce("");

    await createBranch("feature/test", "/repo");
    expect(mockGit).toHaveBeenCalledWith(["checkout", "-b", "feature/test"], "/repo");
  });
});

describe("isBranchMerged", () => {
  test("returns true when branch is in merged list", async () => {
    mockGitSafe.mockResolvedValueOnce("  feature/done");

    const result = await isBranchMerged("feature/done", "main", "/repo");
    expect(result).toBe(true);
    expect(mockGitSafe).toHaveBeenCalledWith(
      ["branch", "--merged", "main", "--list", "feature/done"],
      "/repo",
    );
  });

  test("returns false when gitSafe returns null", async () => {
    mockGitSafe.mockResolvedValueOnce(null);

    const result = await isBranchMerged("feature/wip", "main", "/repo");
    expect(result).toBe(false);
  });

  test("returns false when output is empty string", async () => {
    mockGitSafe.mockResolvedValueOnce("");

    const result = await isBranchMerged("feature/wip", "main", "/repo");
    expect(result).toBe(false);
  });
});

describe("deleteBranch", () => {
  test("returns true on success with -d flag", async () => {
    mockGitSafe.mockResolvedValueOnce("Deleted branch feature/done");

    const result = await deleteBranch("feature/done", "/repo");
    expect(result).toBe(true);
    expect(mockGitSafe).toHaveBeenCalledWith(["branch", "-d", "feature/done"], "/repo");
  });

  test("returns false when gitSafe returns null", async () => {
    mockGitSafe.mockResolvedValueOnce(null);

    const result = await deleteBranch("nonexistent", "/repo");
    expect(result).toBe(false);
  });

  test("uses -D flag when force is true", async () => {
    mockGitSafe.mockResolvedValueOnce("Deleted branch feature/force");

    await deleteBranch("feature/force", "/repo", true);
    expect(mockGitSafe).toHaveBeenCalledWith(["branch", "-D", "feature/force"], "/repo");
  });
});

describe("hasUncommittedChanges", () => {
  test("returns true when porcelain output is non-empty", async () => {
    mockGit.mockResolvedValueOnce("M src/index.ts");

    const result = await hasUncommittedChanges("/repo");
    expect(result).toBe(true);
    expect(mockGit).toHaveBeenCalledWith(["status", "--porcelain"], "/repo");
  });

  test("returns false when porcelain output is empty", async () => {
    mockGit.mockResolvedValueOnce("");

    const result = await hasUncommittedChanges("/repo");
    expect(result).toBe(false);
  });
});

describe("getLastCommitDate", () => {
  test("returns Date when valid timestamp", async () => {
    mockGitSafe.mockResolvedValueOnce("2024-01-15T10:30:00+00:00");

    const result = await getLastCommitDate("main", "/repo");
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe("2024-01-15T10:30:00.000Z");
  });

  test("returns null when gitSafe returns null", async () => {
    mockGitSafe.mockResolvedValueOnce(null);

    const result = await getLastCommitDate("nonexistent", "/repo");
    expect(result).toBeNull();
  });

  test("returns null for invalid timestamp", async () => {
    mockGitSafe.mockResolvedValueOnce("not-a-date");

    const result = await getLastCommitDate("main", "/repo");
    expect(result).toBeNull();
  });
});

describe("fetchOrigin", () => {
  test("calls git with fetch origin --prune", async () => {
    mockGit.mockResolvedValueOnce("");

    await fetchOrigin("/repo");
    expect(mockGit).toHaveBeenCalledWith(["fetch", "origin", "--prune"], "/repo");
  });
});

describe("isGitRepo", () => {
  test("returns true when output is 'true'", async () => {
    mockGitSafe.mockResolvedValueOnce("true");

    const result = await isGitRepo("/repo");
    expect(result).toBe(true);
  });

  test("returns false when output is not 'true'", async () => {
    mockGitSafe.mockResolvedValueOnce(null);

    const result = await isGitRepo("/repo");
    expect(result).toBe(false);
  });
});
