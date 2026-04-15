import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

vi.mock("@cc-framework/workflows", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cc-framework/workflows")>();
  return {
    ...actual,
    cleanupOrphanedWorktrees: vi.fn().mockResolvedValue(0),
  };
});

import { runCleanup } from "../../src/operations/cleanup.ts";
import { cleanupOrphanedWorktrees } from "@cc-framework/workflows";
import type { StoreQueries } from "@cc-framework/workflows";

function makeStore(overrides?: Partial<StoreQueries>): StoreQueries {
  return {
    failOrphanedRuns: vi.fn().mockReturnValue(0),
    expireStaleSessions: vi.fn().mockReturnValue(0),
    ...overrides,
  } as unknown as StoreQueries;
}

describe("runCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls failOrphanedRuns and expireStaleSessions with defaults", async () => {
    const store = makeStore();
    const result = await runCleanup(store, "/tmp/test");

    expect(store.failOrphanedRuns).toHaveBeenCalledOnce();
    expect(store.expireStaleSessions).toHaveBeenCalledWith(24 * 60 * 60 * 1000);
    expect(result).toEqual({ orphanedRuns: 0, expiredSessions: 0, cleanedWorktrees: 0 });
  });

  it("uses custom TTL when provided", async () => {
    const store = makeStore();
    await runCleanup(store, "/tmp/test", { sessionTtlMs: 1000 });

    expect(store.expireStaleSessions).toHaveBeenCalledWith(1000);
  });

  it("passes custom branchPrefix and baseBranch to cleanupOrphanedWorktrees", async () => {
    const store = makeStore();
    await runCleanup(store, "/tmp/test", { branchPrefix: "wf/", baseBranch: "develop" });

    expect(cleanupOrphanedWorktrees).toHaveBeenCalledWith("/tmp/test", "wf/", "develop");
  });

  it("returns worktree count when cleanupOrphanedWorktrees returns > 0", async () => {
    vi.mocked(cleanupOrphanedWorktrees).mockResolvedValue(3);
    const store = makeStore();
    const result = await runCleanup(store, "/tmp/test");

    expect(result.cleanedWorktrees).toBe(3);
  });

  it("returns counts from store methods", async () => {
    const store = makeStore({
      failOrphanedRuns: vi.fn().mockReturnValue(5),
      expireStaleSessions: vi.fn().mockReturnValue(2),
    });
    vi.mocked(cleanupOrphanedWorktrees).mockResolvedValue(1);

    const result = await runCleanup(store, "/tmp/test");

    expect(result).toEqual({ orphanedRuns: 5, expiredSessions: 2, cleanedWorktrees: 1 });
  });

  it("does not throw when worktree cleanup fails", async () => {
    vi.mocked(cleanupOrphanedWorktrees).mockRejectedValue(new Error("not a git repo"));
    const store = makeStore();

    const result = await runCleanup(store, "/tmp/test");

    expect(result.cleanedWorktrees).toBe(0);
    expect(result.orphanedRuns).toBe(0);
  });
});
