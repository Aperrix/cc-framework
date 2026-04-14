import { describe, expect, it } from "vite-plus/test";
import { resolveWorkflowByName, parseWorkflowInvocation } from "../src/router.ts";

describe("resolveWorkflowByName", () => {
  const workflows = [{ name: "fix-issue" }, { name: "feature" }, { name: "comprehensive-review" }];

  it("returns exact match at tier 'exact'", () => {
    const result = resolveWorkflowByName("fix-issue", workflows);
    expect(result).toEqual({ name: "fix-issue", tier: "exact" });
  });

  it("returns case-insensitive match at tier 'case_insensitive'", () => {
    const result = resolveWorkflowByName("Fix-Issue", workflows);
    expect(result).toEqual({ name: "fix-issue", tier: "case_insensitive" });
  });

  it("returns suffix match at tier 'suffix'", () => {
    const result = resolveWorkflowByName("issue", workflows);
    expect(result).toEqual({ name: "fix-issue", tier: "suffix" });
  });

  it("returns suffix match for trailing segment", () => {
    const result = resolveWorkflowByName("review", workflows);
    expect(result).toEqual({ name: "comprehensive-review", tier: "suffix" });
  });

  it("returns substring match at tier 'substring'", () => {
    const result = resolveWorkflowByName("comprehen", workflows);
    expect(result).toEqual({ name: "comprehensive-review", tier: "substring" });
  });

  it("returns null when no workflow matches", () => {
    const result = resolveWorkflowByName("deploy", workflows);
    expect(result).toBeNull();
  });

  it("returns null for ambiguous match at the same tier", () => {
    const ambiguous = [{ name: "fix-issue" }, { name: "fix-bug" }];
    // "fix" is a substring of both, and neither is an exact/case/suffix match
    const result = resolveWorkflowByName("fix", ambiguous);
    expect(result).toBeNull();
  });
});

describe("parseWorkflowInvocation", () => {
  const workflowNames = ["fix-issue", "feature", "comprehensive-review"];

  it("parses /invoke-workflow with a known workflow name", () => {
    const result = parseWorkflowInvocation("/invoke-workflow fix-issue", workflowNames);
    expect(result.workflowName).toBe("fix-issue");
    expect(result.remainingMessage).toBe("");
    expect(result.error).toBeUndefined();
  });

  it("captures remaining message after the command", () => {
    const result = parseWorkflowInvocation(
      "/invoke-workflow fix-issue please fix the login bug",
      workflowNames,
    );
    expect(result.workflowName).toBe("fix-issue");
    expect(result.remainingMessage).toBe("please fix the login bug");
  });

  it("matches workflow name case-insensitively", () => {
    const result = parseWorkflowInvocation("/invoke-workflow Fix-Issue", workflowNames);
    expect(result.workflowName).toBe("fix-issue");
    expect(result.error).toBeUndefined();
  });

  it("returns error for unknown workflow name", () => {
    const result = parseWorkflowInvocation("/invoke-workflow deploy", workflowNames);
    expect(result.workflowName).toBeNull();
    expect(result.error).toContain("Unknown workflow");
    expect(result.error).toContain("deploy");
  });

  it("returns null workflowName when no command is found", () => {
    const result = parseWorkflowInvocation("just a regular message", workflowNames);
    expect(result.workflowName).toBeNull();
    expect(result.remainingMessage).toBe("just a regular message");
    expect(result.error).toBeUndefined();
  });

  it("finds command even after preamble text (multiline)", () => {
    const message = `I've analyzed the request and determined the best workflow.
Here is my recommendation:
/invoke-workflow comprehensive-review`;
    const result = parseWorkflowInvocation(message, workflowNames);
    expect(result.workflowName).toBe("comprehensive-review");
    expect(result.error).toBeUndefined();
  });
});
