import { describe, expect, it } from "vite-plus/test";
import {
  WorkflowRunStatusSchema,
  NodeExecutionStatusSchema,
  NodeOutputSchema,
  ApprovalContextSchema,
  isApprovalContext,
  ArtifactTypeSchema,
} from "../../src/schema/workflow-run.ts";

describe("WorkflowRunStatusSchema", () => {
  it.each(["pending", "running", "paused", "completed", "failed", "cancelled"])(
    "accepts '%s'",
    (status) => {
      expect(WorkflowRunStatusSchema.parse(status)).toBe(status);
    },
  );

  it("rejects invalid status", () => {
    expect(() => WorkflowRunStatusSchema.parse("unknown")).toThrow();
  });
});

describe("NodeExecutionStatusSchema", () => {
  it.each(["pending", "running", "completed", "failed", "skipped"])("accepts '%s'", (status) => {
    expect(NodeExecutionStatusSchema.parse(status)).toBe(status);
  });

  it("rejects invalid status", () => {
    expect(() => NodeExecutionStatusSchema.parse("cancelled")).toThrow();
  });
});

describe("NodeOutputSchema (discriminated union)", () => {
  it("parses a completed output", () => {
    const result = NodeOutputSchema.parse({
      state: "completed",
      output: "done",
      sessionId: "s1",
    });
    expect(result.state).toBe("completed");
    expect(result.output).toBe("done");
    if (result.state === "completed") {
      expect(result.sessionId).toBe("s1");
    }
  });

  it("parses a running output", () => {
    const result = NodeOutputSchema.parse({
      state: "running",
      output: "in progress",
    });
    expect(result.state).toBe("running");
  });

  it("parses a failed output with error", () => {
    const result = NodeOutputSchema.parse({
      state: "failed",
      output: "partial",
      error: "timeout exceeded",
    });
    expect(result.state).toBe("failed");
    if (result.state === "failed") {
      expect(result.error).toBe("timeout exceeded");
    }
  });

  it("rejects a failed output without error", () => {
    expect(() =>
      NodeOutputSchema.parse({
        state: "failed",
        output: "partial",
      }),
    ).toThrow();
  });

  it("parses a pending output", () => {
    const result = NodeOutputSchema.parse({
      state: "pending",
      output: "",
    });
    expect(result.state).toBe("pending");
  });

  it("parses a skipped output", () => {
    const result = NodeOutputSchema.parse({
      state: "skipped",
      output: "condition not met",
    });
    expect(result.state).toBe("skipped");
  });

  it("rejects an invalid state", () => {
    expect(() =>
      NodeOutputSchema.parse({
        state: "cancelled",
        output: "",
      }),
    ).toThrow();
  });

  it("rejects missing output field", () => {
    expect(() =>
      NodeOutputSchema.parse({
        state: "completed",
      }),
    ).toThrow();
  });
});

describe("ApprovalContextSchema", () => {
  it("parses a valid approval context", () => {
    const result = ApprovalContextSchema.parse({
      nodeId: "review",
      message: "Please approve",
    });
    expect(result.nodeId).toBe("review");
    expect(result.message).toBe("Please approve");
  });

  it("parses with optional fields", () => {
    const result = ApprovalContextSchema.parse({
      nodeId: "review",
      message: "Approve iteration",
      type: "interactive_loop",
      iteration: 3,
    });
    expect(result.type).toBe("interactive_loop");
    expect(result.iteration).toBe(3);
  });

  it("rejects missing nodeId", () => {
    expect(() => ApprovalContextSchema.parse({ message: "hi" })).toThrow();
  });

  it("rejects invalid type enum", () => {
    expect(() =>
      ApprovalContextSchema.parse({
        nodeId: "n",
        message: "m",
        type: "invalid",
      }),
    ).toThrow();
  });
});

describe("isApprovalContext", () => {
  it("returns true for valid approval context", () => {
    expect(isApprovalContext({ nodeId: "n1", message: "approve?" })).toBe(true);
  });

  it("returns true with optional fields", () => {
    expect(
      isApprovalContext({
        nodeId: "n1",
        message: "approve?",
        type: "approval",
        iteration: 1,
      }),
    ).toBe(true);
  });

  it("returns false for null", () => {
    expect(isApprovalContext(null)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isApprovalContext("string")).toBe(false);
  });

  it("returns false for missing required fields", () => {
    expect(isApprovalContext({ nodeId: "n1" })).toBe(false);
  });
});

describe("ArtifactTypeSchema", () => {
  it.each(["pr", "commit", "file_created", "file_modified", "branch"])("accepts '%s'", (type) => {
    expect(ArtifactTypeSchema.parse(type)).toBe(type);
  });

  it("rejects invalid artifact type", () => {
    expect(() => ArtifactTypeSchema.parse("directory")).toThrow();
  });
});
