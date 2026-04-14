import { describe, expect, it } from "vite-plus/test";
import { parseValidationResults } from "../src/validation-parser.ts";

describe("parseValidationResults", () => {
  it("parses valid markdown table with pass, fail, and warn results", () => {
    const content = `# Validation Results
| Check | Result |
|-------|--------|
| Tests | \u2705 All pass |
| Lint  | \u274C 3 errors |
| Types | \u26A0\uFE0F skipped |`;

    const results = parseValidationResults(content);
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ check: "tests", result: "pass", error: "All pass" });
    expect(results[1]).toEqual({ check: "lint", result: "fail", error: "3 errors" });
    expect(results[2]).toEqual({ check: "types", result: "warn", error: "skipped" });
  });

  it("returns empty array when no Validation Results header", () => {
    const content = `# Some Other Section
| Check | Result |
|-------|--------|
| Tests | \u2705 All pass |`;

    expect(parseValidationResults(content)).toEqual([]);
  });

  it("returns empty array when no table found after header", () => {
    const content = `# Validation Results
No table here, just text.`;

    expect(parseValidationResults(content)).toEqual([]);
  });

  it("handles table with only pass results", () => {
    const content = `# Validation Results
| Check | Result |
|-------|--------|
| Tests | \u2705 All pass |
| Lint  | \u2705 Clean |
| Types | \u2705 OK |`;

    const results = parseValidationResults(content);
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.result === "pass")).toBe(true);
  });

  it("handles table with error messages in result column", () => {
    const content = `# Validation Results
| Check | Result |
|-------|--------|
| Tests | \u274C 5 tests failed |
| Lint  | \u274C - src/index.ts: unused import |`;

    const results = parseValidationResults(content);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ check: "tests", result: "fail", error: "5 tests failed" });
    expect(results[1]).toEqual({
      check: "lint",
      result: "fail",
      error: "src/index.ts: unused import",
    });
  });

  it("normalizes check names to lowercase kebab-case", () => {
    const content = `# Validation Results
| Check | Result |
|-------|--------|
| Type Check | \u2705 OK |`;

    const results = parseValidationResults(content);
    expect(results[0].check).toBe("type-check");
  });

  it("omits error property when result cell has only an emoji", () => {
    const content = `# Validation Results
| Check | Result |
|-------|--------|
| Tests | \u2705 |`;

    const results = parseValidationResults(content);
    expect(results[0]).toEqual({ check: "tests", result: "pass" });
    expect(results[0]).not.toHaveProperty("error");
  });
});
