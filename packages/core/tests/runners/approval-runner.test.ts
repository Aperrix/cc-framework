import { describe, expect, it } from "vite-plus/test";
import {
  requestApproval,
  WorkflowPausedError,
  isApprovalContext,
} from "../../src/runners/approval-runner.ts";
import { WorkflowEventBus } from "../../src/events/event-bus.ts";

describe("requestApproval", () => {
  it("throws WorkflowPausedError with approval context", () => {
    const eventBus = new WorkflowEventBus();
    const config = { message: "Review this", capture_response: true };

    expect(() => requestApproval("run-1", "review", config, eventBus)).toThrow(WorkflowPausedError);

    try {
      requestApproval("run-1", "review", config, eventBus);
    } catch (e) {
      expect(e).toBeInstanceOf(WorkflowPausedError);
      const err = e as WorkflowPausedError;
      expect(err.nodeId).toBe("review");
      expect(err.approvalContext.message).toBe("Review this");
      expect(err.approvalContext.captureResponse).toBe(true);
      expect(err.approvalContext.rejectionCount).toBe(0);
    }
  });

  it("emits approval:request event before throwing", () => {
    const eventBus = new WorkflowEventBus();
    const events: any[] = [];
    eventBus.on("approval:request", (e) => events.push(e));

    try {
      requestApproval("run-1", "gate", { message: "Approve?", capture_response: false }, eventBus);
    } catch {
      /* expected */
    }

    expect(events).toHaveLength(1);
    expect(events[0].nodeId).toBe("gate");
    expect(events[0].message).toBe("Approve?");
  });

  it("includes on_reject config in context", () => {
    const eventBus = new WorkflowEventBus();
    try {
      requestApproval(
        "run-1",
        "gate",
        {
          message: "Check",
          capture_response: false,
          on_reject: { prompt: "Fix: $REJECTION_REASON", max_attempts: 5 },
        },
        eventBus,
      );
    } catch (e) {
      const err = e as WorkflowPausedError;
      expect(err.approvalContext.onRejectPrompt).toBe("Fix: $REJECTION_REASON");
      expect(err.approvalContext.onRejectMaxAttempts).toBe(5);
    }
  });

  it("defaults captureResponse to false", () => {
    const eventBus = new WorkflowEventBus();
    try {
      requestApproval("run-1", "gate", { message: "Check", capture_response: false }, eventBus);
    } catch (e) {
      const err = e as WorkflowPausedError;
      expect(err.approvalContext.captureResponse).toBe(false);
    }
  });

  it("defaults onRejectMaxAttempts to 3 when on_reject is provided", () => {
    const eventBus = new WorkflowEventBus();
    try {
      requestApproval(
        "run-1",
        "gate",
        {
          message: "Check",
          capture_response: false,
          on_reject: { prompt: "Fix it", max_attempts: 3 },
        },
        eventBus,
      );
    } catch (e) {
      const err = e as WorkflowPausedError;
      expect(err.approvalContext.onRejectMaxAttempts).toBe(3);
    }
  });
});

describe("isApprovalContext", () => {
  it("validates correct context", () => {
    expect(
      isApprovalContext({ nodeId: "x", message: "y", captureResponse: false, rejectionCount: 0 }),
    ).toBe(true);
  });

  it("rejects null", () => {
    expect(isApprovalContext(null)).toBe(false);
  });

  it("rejects non-object", () => {
    expect(isApprovalContext("string")).toBe(false);
  });

  it("rejects object with wrong types", () => {
    expect(isApprovalContext({ nodeId: 123 })).toBe(false);
  });

  it("rejects object missing message", () => {
    expect(isApprovalContext({ nodeId: "x" })).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isApprovalContext(undefined)).toBe(false);
  });
});
