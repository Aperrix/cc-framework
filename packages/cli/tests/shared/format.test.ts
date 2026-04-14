import { describe, expect, it } from "vite-plus/test";
import {
  formatRunStatus,
  formatWorkflowList,
  formatEvent,
  formatError,
} from "../../src/shared/format.ts";

describe("formatRunStatus", () => {
  it("formats a completed run", () => {
    const result = formatRunStatus({
      id: "abc12345-6789",
      status: "completed",
      startedAt: 1000,
      finishedAt: 46000,
    });
    expect(result).toContain("\u2713");
    expect(result).toContain("completed");
    expect(result).toContain("45s");
  });

  it("formats a running run", () => {
    const result = formatRunStatus({
      id: "abc12345-6789",
      status: "running",
      startedAt: Date.now(),
    });
    expect(result).toContain("\u27F3");
    expect(result).toContain("in progress");
  });
});

describe("formatWorkflowList", () => {
  it("formats a list of workflows", () => {
    const result = formatWorkflowList([
      { name: "fix-issue", source: "embedded" },
      { name: "custom", source: "project" },
    ]);
    expect(result).toContain("fix-issue");
    expect(result).toContain("[built-in]");
    expect(result).toContain("[project]");
  });
});

describe("formatEvent", () => {
  it("formats an event with node", () => {
    const result = formatEvent({
      type: "node:complete",
      nodeId: "investigate",
      timestamp: Date.now(),
    });
    expect(result).toContain("node:complete");
    expect(result).toContain("[investigate]");
  });
});

describe("formatError", () => {
  it("prefixes with Error:", () => {
    expect(formatError("something broke")).toBe("Error: something broke");
  });
});
