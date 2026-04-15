import { describe, it, expect } from "vite-plus/test";
import {
  formatWorkflowSection,
  buildRoutingPrompt,
} from "../../src/orchestrator/prompt-builder.ts";
import type { Workflow } from "@cc-framework/workflows";

/** Helper to create a minimal valid Workflow object. */
function makeWorkflow(overrides: Partial<Workflow> & { name: string }): Workflow {
  return {
    interactive: false,
    nodes: [
      {
        id: "step1",
        depends_on: [],
        trigger_rule: "all_success",
        context: "fresh",
        prompt: "do something",
      },
    ],
    ...overrides,
  } as Workflow;
}

describe("formatWorkflowSection", () => {
  it("returns placeholder text for empty array", () => {
    const result = formatWorkflowSection([]);
    expect(result).toContain("No workflows available");
  });

  it("includes name, description, and node count for a single workflow", () => {
    const wf = makeWorkflow({ name: "deploy", description: "Deploy to prod" });
    const result = formatWorkflowSection([wf]);
    expect(result).toContain("deploy");
    expect(result).toContain("Deploy to prod");
    expect(result).toContain("Nodes: 1");
  });

  it("shows 'No description' when description is omitted", () => {
    const wf = makeWorkflow({ name: "bare-wf" });
    const result = formatWorkflowSection([wf]);
    expect(result).toContain("No description");
  });
});

describe("buildRoutingPrompt", () => {
  it("includes 'Available Workflows' heading", () => {
    const wf = makeWorkflow({ name: "test-wf", description: "A test" });
    const result = buildRoutingPrompt([wf], "hello");
    expect(result).toContain("Available Workflows");
  });
});
