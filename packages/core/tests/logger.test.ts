import { describe, expect, it, afterEach } from "vite-plus/test";
import {
  log,
  setLogHandler,
  resetLogHandler,
  logWorkflowStart,
  logWorkflowComplete,
  logWorkflowError,
  logNodeStart,
  logNodeComplete,
  logNodeSkip,
  logNodeError,
  type LogEntry,
} from "../src/logger.ts";

describe("logger", () => {
  const entries: LogEntry[] = [];

  afterEach(() => {
    entries.length = 0;
    resetLogHandler();
  });

  it("emits structured log entries via custom handler", () => {
    setLogHandler((entry) => entries.push(entry));
    log({ level: "info", message: "test message", runId: "abc" });

    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe("info");
    expect(entries[0].message).toBe("test message");
    expect(entries[0].runId).toBe("abc");
  });

  it("logWorkflowStart emits info with workflow name", () => {
    setLogHandler((entry) => entries.push(entry));
    logWorkflowStart("run-123", "my-workflow");

    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe("info");
    expect(entries[0].message).toContain("my-workflow");
    expect(entries[0].runId).toBe("run-123");
  });

  it("logWorkflowComplete includes durationMs", () => {
    setLogHandler((entry) => entries.push(entry));
    logWorkflowComplete("run-123", 5000);

    expect(entries[0].durationMs).toBe(5000);
  });

  it("logWorkflowError emits error level", () => {
    setLogHandler((entry) => entries.push(entry));
    logWorkflowError("run-123", "Something broke");

    expect(entries[0].level).toBe("error");
    expect(entries[0].message).toContain("Something broke");
  });

  it("logNodeStart includes attempt", () => {
    setLogHandler((entry) => entries.push(entry));
    logNodeStart("run-123", "step1", 2);

    expect(entries[0].message).toContain("attempt 2");
    expect(entries[0].nodeId).toBe("step1");
  });

  it("logNodeComplete includes nodeId and durationMs", () => {
    setLogHandler((entry) => entries.push(entry));
    logNodeComplete("run-123", "step1", 1500);

    expect(entries[0].nodeId).toBe("step1");
    expect(entries[0].durationMs).toBe(1500);
  });

  it("logNodeSkip includes reason", () => {
    setLogHandler((entry) => entries.push(entry));
    logNodeSkip("run-123", "step1", "condition false");

    expect(entries[0].message).toContain("condition false");
  });

  it("logNodeError emits error level with attempt", () => {
    setLogHandler((entry) => entries.push(entry));
    logNodeError("run-123", "step1", "timeout", 3);

    expect(entries[0].level).toBe("error");
    expect(entries[0].message).toContain("timeout");
    expect(entries[0].message).toContain("attempt 3");
  });

  it("resetLogHandler restores default", () => {
    setLogHandler((entry) => entries.push(entry));
    resetLogHandler();
    // After reset, custom handler should not receive entries
    log({ level: "info", message: "after reset" });
    expect(entries).toHaveLength(0);
  });
});
