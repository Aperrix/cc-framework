import { describe, expect, it } from "vite-plus/test";
import { runShell } from "../../src/runners/shell-runner.ts";

describe("runShell", () => {
  it("captures stdout", async () => {
    const result = await runShell("echo hello", "/tmp");
    expect(result.output.trim()).toBe("hello");
    expect(result.exitCode).toBe(0);
  });

  it("captures stderr on failure", async () => {
    const result = await runShell("echo error >&2 && exit 1", "/tmp");
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("error");
  });

  it("runs in specified working directory", async () => {
    const result = await runShell("pwd", "/tmp");
    expect(result.output.trim()).toBe("/tmp");
  });
});
