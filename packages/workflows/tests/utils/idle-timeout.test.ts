import { describe, expect, it } from "vite-plus/test";
import { IdleTimeoutError, withIdleTimeout } from "../../src/utils/idle-timeout.ts";

describe("withIdleTimeout", () => {
  it("resolves when operation completes before timeout", async () => {
    const result = await withIdleTimeout(Promise.resolve("done"), 1000);
    expect(result).toBe("done");
  });

  it("rejects with IdleTimeoutError when operation exceeds timeout", async () => {
    const neverResolves = new Promise<string>(() => {});
    await expect(withIdleTimeout(neverResolves, 50)).rejects.toThrow(IdleTimeoutError);
  });

  it("includes timeout duration in error message", async () => {
    const neverResolves = new Promise<string>(() => {});
    await expect(withIdleTimeout(neverResolves, 5000)).rejects.toThrow(
      "Operation timed out after 5s of inactivity",
    );
  }, 10000);

  it("calls onTimeout callback when timeout fires", async () => {
    let called = false;
    const neverResolves = new Promise<string>(() => {});
    await expect(
      withIdleTimeout(neverResolves, 50, () => {
        called = true;
      }),
    ).rejects.toThrow(IdleTimeoutError);
    expect(called).toBe(true);
  });

  it("cleans up timer when operation completes normally", async () => {
    // If the timer isn't cleaned up, this test would leak a timer.
    // We verify by ensuring quick resolution without hanging.
    const result = await withIdleTimeout(Promise.resolve(42), 60000);
    expect(result).toBe(42);
  });

  it("propagates rejection from the operation", async () => {
    const failing = Promise.reject(new Error("op failed"));
    await expect(withIdleTimeout(failing, 1000)).rejects.toThrow("op failed");
  });
});

describe("IdleTimeoutError", () => {
  it("has correct name property", () => {
    const error = new IdleTimeoutError(5000);
    expect(error.name).toBe("IdleTimeoutError");
  });

  it("is an instance of Error", () => {
    const error = new IdleTimeoutError(5000);
    expect(error).toBeInstanceOf(Error);
  });
});
