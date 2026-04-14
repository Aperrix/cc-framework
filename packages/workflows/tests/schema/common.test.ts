import { describe, expect, it } from "vite-plus/test";
import {
  TriggerRuleSchema,
  WhenConditionSchema,
  RetrySchema,
  IsolationSchema,
  ThinkingConfigSchema,
  EffortLevelSchema,
  SandboxSchema,
  isTriggerRule,
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

describe("isTriggerRule", () => {
  it("returns true for valid trigger rules", () => {
    expect(isTriggerRule("all_success")).toBe(true);
    expect(isTriggerRule("one_success")).toBe(true);
  });

  it("returns false for invalid values", () => {
    expect(isTriggerRule("invalid")).toBe(false);
    expect(isTriggerRule(42)).toBe(false);
    expect(isTriggerRule(null)).toBe(false);
  });
});

describe("WhenConditionSchema", () => {
  it("accepts valid when conditions", () => {
    expect(WhenConditionSchema.parse("$node1.output == 'VALUE'")).toBe("$node1.output == 'VALUE'");
    expect(WhenConditionSchema.parse("$a.output > '80' && $b.output == 'true'")).toBe(
      "$a.output > '80' && $b.output == 'true'",
    );
  });

  it("rejects empty strings", () => {
    expect(() => WhenConditionSchema.parse("")).toThrow();
  });
});

describe("RetrySchema", () => {
  it("accepts valid retry config", () => {
    const result = RetrySchema.parse({
      max_attempts: 3,
      delay_ms: 5000,
      on_error: "transient",
    });
    expect(result.max_attempts).toBe(3);
    expect(result.delay_ms).toBe(5000);
    expect(result.on_error).toBe("transient");
  });

  it("applies defaults", () => {
    const result = RetrySchema.parse({ max_attempts: 2 });
    expect(result.delay_ms).toBe(3000);
    expect(result.on_error).toBe("transient");
  });

  it("rejects max_attempts above 5", () => {
    expect(() => RetrySchema.parse({ max_attempts: 10 })).toThrow();
  });

  it("rejects delay_ms below 1000", () => {
    expect(() => RetrySchema.parse({ max_attempts: 1, delay_ms: 500 })).toThrow();
  });

  it("rejects delay_ms above 60000", () => {
    expect(() => RetrySchema.parse({ max_attempts: 1, delay_ms: 100000 })).toThrow();
  });
});

describe("IsolationSchema", () => {
  it("accepts worktree strategy", () => {
    const result = IsolationSchema.parse({
      strategy: "worktree",
      branch_prefix: "ccf/",
    });
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

describe("ThinkingConfigSchema", () => {
  it("accepts string shorthand 'adaptive'", () => {
    expect(ThinkingConfigSchema.parse("adaptive")).toBe("adaptive");
  });

  it("accepts string shorthand 'disabled'", () => {
    expect(ThinkingConfigSchema.parse("disabled")).toBe("disabled");
  });

  it("accepts object form { type: 'adaptive' }", () => {
    const result = ThinkingConfigSchema.parse({ type: "adaptive" });
    expect(result).toEqual({ type: "adaptive" });
  });

  it("accepts object form { type: 'enabled', budgetTokens }", () => {
    const result = ThinkingConfigSchema.parse({
      type: "enabled",
      budgetTokens: 4096,
    });
    expect(result).toEqual({ type: "enabled", budgetTokens: 4096 });
  });

  it("accepts object form { type: 'disabled' }", () => {
    const result = ThinkingConfigSchema.parse({ type: "disabled" });
    expect(result).toEqual({ type: "disabled" });
  });

  it("rejects invalid string", () => {
    expect(() => ThinkingConfigSchema.parse("invalid")).toThrow();
  });
});

describe("EffortLevelSchema", () => {
  it("accepts valid levels", () => {
    expect(EffortLevelSchema.parse("low")).toBe("low");
    expect(EffortLevelSchema.parse("medium")).toBe("medium");
    expect(EffortLevelSchema.parse("high")).toBe("high");
    expect(EffortLevelSchema.parse("max")).toBe("max");
  });

  it("rejects invalid levels", () => {
    expect(() => EffortLevelSchema.parse("extreme")).toThrow();
  });
});

describe("SandboxSchema", () => {
  it("accepts minimal config", () => {
    const result = SandboxSchema.parse({});
    expect(result.enabled).toBe(false);
  });

  it("accepts full config", () => {
    const result = SandboxSchema.parse({
      enabled: true,
      autoAllowBashIfSandboxed: true,
      ignoreViolations: false,
      filesystem: { denyWrite: ["/etc"] },
      network: { allowedDomains: ["api.example.com"], allowManagedDomainsOnly: true },
    });
    expect(result.enabled).toBe(true);
    expect(result.autoAllowBashIfSandboxed).toBe(true);
    expect(result.filesystem?.denyWrite).toEqual(["/etc"]);
    expect(result.network?.allowedDomains).toEqual(["api.example.com"]);
  });
});
