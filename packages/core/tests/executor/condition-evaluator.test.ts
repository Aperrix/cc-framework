import { describe, expect, it } from "vite-plus/test";
import {
  evaluateCondition,
  splitOutsideQuotes,
  checkTriggerRule,
} from "../../src/executor/condition-evaluator.ts";

describe("splitOutsideQuotes", () => {
  it("splits normally when no quotes", () => {
    expect(splitOutsideQuotes("a || b", "||")).toEqual(["a", "b"]);
  });

  it("does not split inside quotes", () => {
    expect(splitOutsideQuotes("$n.output == 'a||b' || $m.output == 'c'", "||")).toEqual([
      "$n.output == 'a||b'",
      "$m.output == 'c'",
    ]);
  });

  it("handles && inside quotes", () => {
    expect(splitOutsideQuotes("$n.output == 'a&&b' && $m.output == 'c'", "&&")).toEqual([
      "$n.output == 'a&&b'",
      "$m.output == 'c'",
    ]);
  });
});

describe("evaluateCondition", () => {
  const outputs = {
    classify: { output: JSON.stringify({ type: "bug", severity: "high" }) },
    score: { output: "85" },
    check: { output: "ok" },
  };

  it("evaluates simple field comparison", () => {
    expect(evaluateCondition("$classify.output.type == 'bug'", outputs)).toBe(true);
    expect(evaluateCondition("$classify.output.type == 'feature'", outputs)).toBe(false);
  });

  it("evaluates full output comparison", () => {
    expect(evaluateCondition("$check.output == 'ok'", outputs)).toBe(true);
  });

  it("evaluates numeric comparisons", () => {
    expect(evaluateCondition("$score.output > '80'", outputs)).toBe(true);
    expect(evaluateCondition("$score.output < '80'", outputs)).toBe(false);
  });

  it("evaluates && (AND)", () => {
    expect(
      evaluateCondition("$classify.output.type == 'bug' && $check.output == 'ok'", outputs),
    ).toBe(true);
    expect(
      evaluateCondition("$classify.output.type == 'bug' && $check.output == 'fail'", outputs),
    ).toBe(false);
  });

  it("evaluates || (OR)", () => {
    expect(
      evaluateCondition("$classify.output.type == 'feature' || $check.output == 'ok'", outputs),
    ).toBe(true);
  });

  it("handles quoted values with special chars", () => {
    const out = { msg: { output: "a||b" } };
    expect(evaluateCondition("$msg.output == 'a||b'", out)).toBe(true);
  });

  it("returns false for missing node", () => {
    expect(evaluateCondition("$missing.output == 'x'", outputs)).toBe(false);
  });

  it("returns false for invalid expression", () => {
    expect(evaluateCondition("garbage", outputs)).toBe(false);
  });
});

describe("checkTriggerRule", () => {
  const success = { completed: true, failed: false, skipped: false };
  const failure = { completed: false, failed: true, skipped: false };
  const skipped = { completed: false, failed: false, skipped: true };

  it("all_success: requires all deps succeeded", () => {
    expect(checkTriggerRule("all_success", [success, success])).toBe(true);
    expect(checkTriggerRule("all_success", [success, failure])).toBe(false);
  });

  it("one_success: requires at least one", () => {
    expect(checkTriggerRule("one_success", [failure, success])).toBe(true);
    expect(checkTriggerRule("one_success", [failure, failure])).toBe(false);
  });

  it("none_failed_min_one_success: no failures + at least one success", () => {
    expect(checkTriggerRule("none_failed_min_one_success", [success, skipped])).toBe(true);
    expect(checkTriggerRule("none_failed_min_one_success", [success, failure])).toBe(false);
    expect(checkTriggerRule("none_failed_min_one_success", [skipped, skipped])).toBe(false);
  });

  it("all_done: all deps are terminal", () => {
    expect(checkTriggerRule("all_done", [success, failure, skipped])).toBe(true);
  });

  it("passes with no dependencies", () => {
    expect(checkTriggerRule("all_success", [])).toBe(true);
  });
});
