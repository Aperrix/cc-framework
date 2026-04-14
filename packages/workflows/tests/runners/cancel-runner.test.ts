import { describe, expect, it } from "vite-plus/test";
import { runCancel, WorkflowCancelledError } from "../../src/runners/cancel-runner.ts";

describe("runCancel", () => {
  it("throws WorkflowCancelledError with the given reason", () => {
    expect(() => runCancel("Merge conflicts detected")).toThrow(WorkflowCancelledError);
    expect(() => runCancel("Merge conflicts detected")).toThrow(
      "Workflow cancelled: Merge conflicts detected",
    );
  });

  it("exposes the reason on the error instance", () => {
    let caught: WorkflowCancelledError | undefined;
    try {
      runCancel("budget exceeded");
      expect(true).toBe(false); // Should have thrown
    } catch (e) {
      caught = e as WorkflowCancelledError;
    }
    expect(caught).toBeInstanceOf(WorkflowCancelledError);
    expect(caught!.reason).toBe("budget exceeded");
  });
});
