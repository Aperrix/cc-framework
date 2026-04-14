import { describe, expect, it } from "vite-plus/test";
import { runScript } from "../../src/runners/script-runner.ts";

describe("runScript", () => {
  it("captures stdout with bash (default runtime)", async () => {
    const result = await runScript("echo hello", "/tmp");
    expect(result.output.trim()).toBe("hello");
    expect(result.exitCode).toBe(0);
  });

  it("captures stderr on failure", async () => {
    const result = await runScript("echo error >&2 && exit 1", "/tmp");
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("error");
  });

  it("runs in specified working directory", async () => {
    const result = await runScript("pwd", "/tmp");
    expect(result.output.trim()).toBe("/tmp");
  });

  it("respects timeout", async () => {
    const result = await runScript("sleep 10", "/tmp", "bash", undefined, 100);
    expect(result.exitCode).not.toBe(0);
  });

  it("handles non-zero exit code", async () => {
    const result = await runScript("exit 42", "/tmp", "bash");
    expect(result.exitCode).toBe(42);
  });

  it("runs a bash file script", async () => {
    // Create a temp script file
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const path = "/tmp/test-ccf-script.sh";
    writeFileSync(path, '#!/bin/bash\necho "from file"');
    try {
      const result = await runScript(path, "/tmp");
      expect(result.output.trim()).toBe("from file");
      expect(result.exitCode).toBe(0);
    } finally {
      unlinkSync(path);
    }
  });
});
