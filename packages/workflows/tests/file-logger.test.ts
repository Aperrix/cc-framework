import { readFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import {
  logFileEvent,
  logFileWorkflowStart,
  logFileNodeComplete,
  type WorkflowFileEvent,
} from "../src/file-logger.ts";

describe("file-logger", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ccf-file-logger-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("writes a JSONL event to the log file", async () => {
    await logFileEvent(tempDir, "run-1", { type: "workflow_start", workflow_name: "test-wf" });

    const content = await readFile(join(tempDir, "run-1.jsonl"), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);

    const parsed: WorkflowFileEvent = JSON.parse(lines[0]);
    expect(parsed.type).toBe("workflow_start");
    expect(parsed.workflow_id).toBe("run-1");
    expect(parsed.workflow_name).toBe("test-wf");
    expect(parsed.ts).toBeTruthy();
    expect(() => new Date(parsed.ts)).not.toThrow();
  });

  it("appends multiple events to the same file", async () => {
    await logFileEvent(tempDir, "run-2", { type: "node_start", step: "build" });
    await logFileEvent(tempDir, "run-2", {
      type: "node_complete",
      step: "build",
      duration_ms: 150,
    });
    await logFileEvent(tempDir, "run-2", { type: "workflow_complete", duration_ms: 300 });

    const content = await readFile(join(tempDir, "run-2.jsonl"), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(3);

    for (const line of lines) {
      const parsed: WorkflowFileEvent = JSON.parse(line);
      expect(parsed.workflow_id).toBe("run-2");
      expect(parsed.ts).toBeTruthy();
    }

    const last: WorkflowFileEvent = JSON.parse(lines[2]);
    expect(last.type).toBe("workflow_complete");
    expect(last.duration_ms).toBe(300);
  });

  it("each line is valid JSON with ts and workflow_id", async () => {
    await logFileWorkflowStart(tempDir, "run-3", "my-workflow");
    await logFileNodeComplete(tempDir, "run-3", "step-a", 42);

    const content = await readFile(join(tempDir, "run-3.jsonl"), "utf-8");
    const lines = content.trim().split("\n");

    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed).toHaveProperty("ts");
      expect(parsed).toHaveProperty("workflow_id", "run-3");
    }
  });

  it("does not throw on write failure", async () => {
    // Use null byte in path which is invalid on all platforms
    await expect(
      logFileEvent("/dev/null/\0invalid", "run-4", { type: "workflow_error", error: "boom" }),
    ).resolves.toBeUndefined();
  });

  it("creates nested directories if needed", async () => {
    const nestedDir = join(tempDir, "deep", "nested", "logs");
    await logFileEvent(nestedDir, "run-5", { type: "node_start", step: "init" });

    const content = await readFile(join(nestedDir, "run-5.jsonl"), "utf-8");
    const parsed: WorkflowFileEvent = JSON.parse(content.trim());
    expect(parsed.type).toBe("node_start");
    expect(parsed.step).toBe("init");
  });
});
