import { describe, expect, it, vi } from "vite-plus/test";
import { installDeps } from "../../src/runners/script-runner.ts";

// Mock child_process.execFile to capture install commands
vi.mock("node:child_process", () => {
  const execFile = vi.fn(
    (_cmd: string, _args: string[], _opts: unknown, cb?: (err: Error | null) => void) => {
      if (cb) cb(null);
      return { stdout: "", stderr: "" };
    },
  );
  return { execFile };
});

vi.mock("node:util", () => ({
  promisify:
    (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) =>
      new Promise((resolve, reject) => {
        fn(...args, (err: Error | null, ...result: unknown[]) => {
          if (err) reject(err);
          else resolve(result.length <= 1 ? result[0] : result);
        });
      }),
}));

import { execFile } from "node:child_process";

describe("installDeps", () => {
  it("calls bun add for bun runtime with deps", async () => {
    await installDeps(["lodash", "zod"], "bun", "/tmp/project");

    expect(execFile).toHaveBeenCalledWith(
      "bun",
      ["add", "lodash", "zod"],
      expect.objectContaining({ cwd: "/tmp/project" }),
      expect.any(Function),
    );
  });

  it("calls uv pip install for uv runtime with deps", async () => {
    await installDeps(["requests", "click"], "uv", "/tmp/project");

    expect(execFile).toHaveBeenCalledWith(
      "uv",
      ["pip", "install", "requests", "click"],
      expect.objectContaining({ cwd: "/tmp/project" }),
      expect.any(Function),
    );
  });

  it("skips installation when deps array is empty", async () => {
    vi.mocked(execFile).mockClear();
    await installDeps([], "bun", "/tmp/project");

    expect(execFile).not.toHaveBeenCalled();
  });

  it("skips installation for bash runtime", async () => {
    vi.mocked(execFile).mockClear();
    await installDeps(["some-package"], "bash", "/tmp/project");

    expect(execFile).not.toHaveBeenCalled();
  });
});
