import { describe, expect, it } from "vite-plus/test";
import { runCancel, WorkflowCancelledError } from "../../src/runners/cancel-runner.ts";

describe("runCancel", () => {
  it("throws WorkflowCancelledError with reason", () => {
    expect(() => runCancel("Merge conflicts detected")).toThrow(WorkflowCancelledError);
    expect(() => runCancel("Merge conflicts detected")).toThrow("Merge conflicts detected");
  });

  it("error has the correct reason property", () => {
    try {
      runCancel("test reason");
    } catch (e) {
      expect(e).toBeInstanceOf(WorkflowCancelledError);
      expect((e as WorkflowCancelledError).reason).toBe("test reason");
    }
  });

  it("error has the correct name", () => {
    try {
      runCancel("any reason");
    } catch (e) {
      expect((e as WorkflowCancelledError).name).toBe("WorkflowCancelledError");
    }
  });

  it("error message includes the reason", () => {
    try {
      runCancel("budget exceeded");
    } catch (e) {
      expect((e as Error).message).toBe("Workflow cancelled: budget exceeded");
    }
  });
});
