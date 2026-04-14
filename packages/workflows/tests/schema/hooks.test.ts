import { describe, expect, it } from "vite-plus/test";
import { NodeHooksSchema, HookMatcherSchema, HOOK_EVENTS } from "../../src/schema/hooks.ts";

describe("HookMatcherSchema", () => {
  it("accepts a valid matcher with all fields", () => {
    const result = HookMatcherSchema.parse({
      matcher: "Read",
      response: { allow: true },
      timeout: 5000,
    });
    expect(result.matcher).toBe("Read");
    expect(result.response).toEqual({ allow: true });
    expect(result.timeout).toBe(5000);
  });

  it("accepts a matcher without optional fields", () => {
    const result = HookMatcherSchema.parse({
      response: { deny: true },
    });
    expect(result.matcher).toBeUndefined();
    expect(result.timeout).toBeUndefined();
  });

  it("rejects a matcher with non-positive timeout", () => {
    expect(() =>
      HookMatcherSchema.parse({
        response: {},
        timeout: 0,
      }),
    ).toThrow();
  });

  it("rejects a matcher without response", () => {
    expect(() => HookMatcherSchema.parse({ matcher: "Read" })).toThrow();
  });
});

describe("NodeHooksSchema", () => {
  it("accepts valid hooks for known events", () => {
    const result = NodeHooksSchema.parse({
      PreToolUse: [{ matcher: "Bash", response: { allow: true } }],
      PostToolUse: [{ response: { log: true } }],
    });
    expect(result.PreToolUse).toHaveLength(1);
    expect(result.PostToolUse).toHaveLength(1);
  });

  it("accepts an empty object", () => {
    const result = NodeHooksSchema.parse({});
    expect(result).toEqual({});
  });

  it("accepts all known event names", () => {
    const hooks: Record<string, unknown[]> = {};
    for (const event of HOOK_EVENTS) {
      hooks[event] = [{ response: {} }];
    }
    const result = NodeHooksSchema.parse(hooks);
    for (const event of HOOK_EVENTS) {
      expect(result[event]).toHaveLength(1);
    }
  });

  it("rejects unknown event names via strict()", () => {
    expect(() =>
      NodeHooksSchema.parse({
        PreToolUse: [{ response: {} }],
        OnTypo: [{ response: {} }],
      }),
    ).toThrow();
  });

  it("rejects misspelled event names", () => {
    expect(() =>
      NodeHooksSchema.parse({
        preToolUse: [{ response: {} }],
      }),
    ).toThrow();
  });

  it("rejects invalid matcher arrays", () => {
    expect(() =>
      NodeHooksSchema.parse({
        PreToolUse: [{ matcher: 42 }],
      }),
    ).toThrow();
  });
});
