import { describe, expect, it } from "vite-plus/test";
import { substituteVariables } from "../../src/variables/substitute.ts";

describe("substituteVariables", () => {
  it("replaces $ARGUMENTS", () => {
    const result = substituteVariables("Fix issue $ARGUMENTS", { ARGUMENTS: "#42" });
    expect(result).toBe("Fix issue #42");
  });

  it("replaces $USER_MESSAGE as alias for $ARGUMENTS", () => {
    const result = substituteVariables("Task: $USER_MESSAGE", { ARGUMENTS: "fix the bug" });
    expect(result).toBe("Task: fix the bug");
  });

  it("replaces $WORKFLOW_ID", () => {
    const result = substituteVariables("Run $WORKFLOW_ID", { WORKFLOW_ID: "run-abc" });
    expect(result).toBe("Run run-abc");
  });

  it("replaces $ARTIFACTS_DIR", () => {
    const result = substituteVariables("Save to $ARTIFACTS_DIR/report.md", {
      ARTIFACTS_DIR: "/tmp/artifacts",
    });
    expect(result).toBe("Save to /tmp/artifacts/report.md");
  });

  it("replaces $nodeId.output", () => {
    const result = substituteVariables(
      "Plan: $plan.output",
      {},
      { plan: { output: "Step 1: do this" } },
    );
    expect(result).toBe("Plan: Step 1: do this");
  });

  it("replaces $nodeId.output.field with JSON extraction", () => {
    const result = substituteVariables(
      "Type: $classify.output.type",
      {},
      {
        classify: { output: JSON.stringify({ type: "bug", severity: "high" }) },
      },
    );
    expect(result).toBe("Type: bug");
  });

  it("leaves unknown variables unchanged", () => {
    const result = substituteVariables("$UNKNOWN stays", {});
    expect(result).toBe("$UNKNOWN stays");
  });

  it("handles multiple substitutions", () => {
    const result = substituteVariables("Fix $ARGUMENTS in $BASE_BRANCH", {
      ARGUMENTS: "#42",
      BASE_BRANCH: "main",
    });
    expect(result).toBe("Fix #42 in main");
  });
});
