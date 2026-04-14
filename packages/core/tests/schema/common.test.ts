import { describe, expect, it } from "vite-plus/test";
import {
  TriggerRuleSchema,
  WhenConditionSchema,
  RetrySchema,
  IsolationSchema,
} from "../../src/schema/common.ts";

describe("TriggerRuleSchema", () => {
  it("accepts valid trigger rules", () => {
    expect(TriggerRuleSchema.parse("all_success")).toBe("all_success");
    expect(TriggerRuleSchema.parse("one_success")).toBe("one_success");
    expect(TriggerRuleSchema.parse("none_failed_min_one_success")).toBe(
      "none_failed_min_one_success",
    );
    expect(TriggerRuleSchema.parse("all_done")).toBe("all_done");
  });

  it("rejects invalid trigger rules", () => {
    expect(() => TriggerRuleSchema.parse("invalid")).toThrow();
  });
});

describe("WhenConditionSchema", () => {
  it("accepts valid when conditions", () => {
    expect(WhenConditionSchema.parse("$node1.output == 'VALUE'")).toBe("$node1.output == 'VALUE'");
    expect(WhenConditionSchema.parse("$a.output > '80' && $b.output == 'true'")).toBe(
      "$a.output > '80' && $b.output == 'true'",
    );
  });
});

describe("RetrySchema", () => {
  it("accepts valid retry config", () => {
    const result = RetrySchema.parse({ max_attempts: 3, delay_ms: 5000, on_error: "transient" });
    expect(result.max_attempts).toBe(3);
    expect(result.delay_ms).toBe(5000);
    expect(result.on_error).toBe("transient");
  });

  it("applies defaults", () => {
    const result = RetrySchema.parse({ max_attempts: 2 });
    expect(result.delay_ms).toBe(3000);
    expect(result.on_error).toBe("transient");
  });
});

describe("IsolationSchema", () => {
  it("accepts worktree strategy", () => {
    const result = IsolationSchema.parse({ strategy: "worktree", branch_prefix: "ccf/" });
    expect(result.strategy).toBe("worktree");
    expect(result.branch_prefix).toBe("ccf/");
  });

  it("accepts branch strategy", () => {
    const result = IsolationSchema.parse({ strategy: "branch" });
    expect(result.strategy).toBe("branch");
  });

  it("defaults branch_prefix", () => {
    const result = IsolationSchema.parse({ strategy: "worktree" });
    expect(result.branch_prefix).toBe("ccf/");
  });
});
