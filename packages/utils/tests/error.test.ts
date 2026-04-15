import { describe, expect, it } from "vite-plus/test";
import {
  CcfError,
  WorkflowNotFoundError,
  NodeExecutionError,
  ConfigError,
  ValidationError,
  formatError,
  toError,
} from "../src/error.ts";

describe("CcfError", () => {
  it("has code property", () => {
    const error = new CcfError("something went wrong", "SOME_CODE");
    expect(error.code).toBe("SOME_CODE");
    expect(error.message).toBe("something went wrong");
    expect(error.name).toBe("CcfError");
  });

  it("is an instance of Error", () => {
    const error = new CcfError("test", "TEST");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("WorkflowNotFoundError", () => {
  it("has correct code and message", () => {
    const error = new WorkflowNotFoundError("deploy");
    expect(error.code).toBe("WORKFLOW_NOT_FOUND");
    expect(error.message).toBe('Workflow "deploy" not found');
  });
});

describe("NodeExecutionError", () => {
  it("includes nodeId and cause in message", () => {
    const error = new NodeExecutionError("step-1", "timeout");
    expect(error.code).toBe("NODE_EXECUTION_ERROR");
    expect(error.message).toBe('Node "step-1" failed: timeout');
  });
});

describe("ConfigError", () => {
  it("has CONFIG_ERROR code", () => {
    const error = new ConfigError("invalid yaml");
    expect(error.code).toBe("CONFIG_ERROR");
    expect(error.message).toBe("invalid yaml");
  });
});

describe("ValidationError", () => {
  it("has VALIDATION_ERROR code", () => {
    const error = new ValidationError("missing required field");
    expect(error.code).toBe("VALIDATION_ERROR");
  });
});

describe("toError", () => {
  it("returns same Error for Error input", () => {
    const err = new Error("original");
    expect(toError(err)).toBe(err);
  });

  it("wraps string in Error", () => {
    const result = toError("something failed");
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("something failed");
  });

  it("wraps object in Error with string representation", () => {
    const result = toError({ code: 42 });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("[object Object]");
  });

  it("wraps null in Error", () => {
    const result = toError(null);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("null");
  });

  it("wraps undefined in Error", () => {
    const result = toError(undefined);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("undefined");
  });
});

describe("formatError", () => {
  it("formats CcfError with code", () => {
    const error = new CcfError("bad config", "CONFIG_ERROR");
    expect(formatError(error)).toBe("[CONFIG_ERROR] bad config");
  });

  it("formats plain Error without code", () => {
    const error = new Error("something failed");
    expect(formatError(error)).toBe("something failed");
  });

  it("handles non-Error values", () => {
    expect(formatError("string error")).toBe("string error");
    expect(formatError(42)).toBe("42");
    expect(formatError(null)).toBe("null");
  });
});
