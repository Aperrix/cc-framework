import { describe, test, expect, vi, beforeEach } from "vite-plus/test";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { execFile } from "node:child_process";
import { git, gitSafe } from "../src/exec.ts";

const mockExecFile = vi.mocked(execFile);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("git", () => {
  test("returns trimmed stdout on success", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      (callback as CallableFunction)(null, { stdout: "abc123\n", stderr: "" });
      return undefined as never;
    });

    const result = await git(["rev-parse", "HEAD"], "/repo");
    expect(result).toBe("abc123");
  });

  test("throws on non-zero exit", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      (callback as CallableFunction)(new Error("exit code 128"), { stdout: "", stderr: "fatal" });
      return undefined as never;
    });

    await expect(git(["status"], "/repo")).rejects.toThrow("exit code 128");
  });
});

describe("gitSafe", () => {
  test("returns stdout on success", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      (callback as CallableFunction)(null, { stdout: "output\n", stderr: "" });
      return undefined as never;
    });

    const result = await gitSafe(["status"], "/repo");
    expect(result).toBe("output");
  });

  test("returns null on failure", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      (callback as CallableFunction)(new Error("fail"), { stdout: "", stderr: "" });
      return undefined as never;
    });

    const result = await gitSafe(["bad-command"], "/repo");
    expect(result).toBeNull();
  });
});
