import { describe, expect, it } from "vite-plus/test";
import { classifyError, isRetryable } from "../../src/runners/error-classifier.ts";

describe("classifyError", () => {
  it("classifies auth errors as fatal", () => {
    expect(classifyError(new Error("Authentication failed")).severity).toBe("fatal");
    expect(classifyError(new Error("Invalid API key")).severity).toBe("fatal");
    expect(classifyError(new Error("Permission denied")).severity).toBe("fatal");
  });

  it("classifies billing errors as fatal", () => {
    expect(classifyError(new Error("Insufficient credit")).severity).toBe("fatal");
    expect(classifyError(new Error("Billing issue")).severity).toBe("fatal");
    expect(classifyError(new Error("Quota exceeded")).severity).toBe("fatal");
  });

  it("classifies authorization errors as fatal", () => {
    expect(classifyError(new Error("403 Forbidden")).severity).toBe("fatal");
    expect(classifyError(new Error("401 Unauthorized")).severity).toBe("fatal");
  });

  it("classifies rate limits as transient", () => {
    expect(classifyError(new Error("Rate limit exceeded")).severity).toBe("transient");
    expect(classifyError(new Error("429 Too Many Requests")).severity).toBe("transient");
    expect(classifyError(new Error("Request timeout")).severity).toBe("transient");
  });

  it("classifies network errors as transient", () => {
    expect(classifyError(new Error("ECONNRESET")).severity).toBe("transient");
    expect(classifyError(new Error("ECONNREFUSED")).severity).toBe("transient");
    expect(classifyError(new Error("ETIMEDOUT")).severity).toBe("transient");
    expect(classifyError(new Error("socket hang up")).severity).toBe("transient");
  });

  it("classifies server errors as transient", () => {
    expect(classifyError(new Error("503 Service Unavailable")).severity).toBe("transient");
    expect(classifyError(new Error("529 Overloaded")).severity).toBe("transient");
    expect(classifyError(new Error("Server overloaded")).severity).toBe("transient");
  });

  it("classifies process errors as transient", () => {
    expect(classifyError(new Error("subprocess crashed unexpectedly")).severity).toBe("transient");
    expect(classifyError(new Error("Script failed with exit code 1")).severity).toBe("transient");
  });

  it("classifies unknown errors", () => {
    expect(classifyError(new Error("Something weird")).severity).toBe("unknown");
    expect(classifyError(new Error("Unexpected null")).severity).toBe("unknown");
  });

  it("handles non-Error values", () => {
    expect(classifyError("string error").severity).toBe("unknown");
    expect(classifyError(42).severity).toBe("unknown");
    expect(classifyError(null).severity).toBe("unknown");
    expect(classifyError("Rate limit hit").severity).toBe("transient");
    expect(classifyError("Authentication required").severity).toBe("fatal");
  });
});

describe("isRetryable", () => {
  it("never retries fatal errors", () => {
    const fatal = classifyError(new Error("Auth failed"));
    expect(isRetryable(fatal, "all")).toBe(false);
    expect(isRetryable(fatal, "transient")).toBe(false);
  });

  it("retries transient errors in transient scope", () => {
    const transient = classifyError(new Error("Rate limit exceeded"));
    expect(isRetryable(transient, "transient")).toBe(true);
  });

  it("retries transient errors in all scope", () => {
    const transient = classifyError(new Error("Rate limit exceeded"));
    expect(isRetryable(transient, "all")).toBe(true);
  });

  it("retries unknown errors only in 'all' scope", () => {
    const unknown = classifyError(new Error("Something weird"));
    expect(isRetryable(unknown, "transient")).toBe(false);
    expect(isRetryable(unknown, "all")).toBe(true);
  });
});
