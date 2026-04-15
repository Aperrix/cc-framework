import { describe, it, expect } from "vite-plus/test";
import {
  shouldCreateNewSession,
  shouldDeactivateSession,
  detectPlanToExecuteTransition,
  getTriggerForCommand,
  type TransitionTrigger,
} from "../../src/state/session-transitions.ts";

describe("shouldCreateNewSession", () => {
  it("returns true only for plan-to-execute", () => {
    expect(shouldCreateNewSession("plan-to-execute")).toBe(true);
  });

  it("returns false for all other triggers", () => {
    const others: TransitionTrigger[] = [
      "first-message",
      "isolation-changed",
      "reset-requested",
      "worktree-removed",
    ];
    for (const trigger of others) {
      expect(shouldCreateNewSession(trigger)).toBe(false);
    }
  });
});

describe("shouldDeactivateSession", () => {
  it("returns false only for first-message", () => {
    expect(shouldDeactivateSession("first-message")).toBe(false);
  });

  it("returns true for all deactivating triggers", () => {
    const deactivating: TransitionTrigger[] = [
      "plan-to-execute",
      "isolation-changed",
      "reset-requested",
      "worktree-removed",
    ];
    for (const trigger of deactivating) {
      expect(shouldDeactivateSession(trigger)).toBe(true);
    }
  });
});

describe("detectPlanToExecuteTransition", () => {
  it("returns plan-to-execute when execute follows a plan workflow", () => {
    expect(detectPlanToExecuteTransition("fix-issue", "feature")).toBe("plan-to-execute");
    expect(detectPlanToExecuteTransition("refactor", "review")).toBe("plan-to-execute");
  });

  it("returns null when there is no plan→execute pattern", () => {
    expect(detectPlanToExecuteTransition("feature", "fix-issue")).toBeNull();
    expect(detectPlanToExecuteTransition("assist", "test")).toBeNull();
  });

  it("returns null for null/undefined inputs", () => {
    expect(detectPlanToExecuteTransition(null, "feature")).toBeNull();
    expect(detectPlanToExecuteTransition("fix-issue", null)).toBeNull();
    expect(detectPlanToExecuteTransition(undefined, undefined)).toBeNull();
  });
});

describe("getTriggerForCommand", () => {
  it("returns reset-requested for reset", () => {
    expect(getTriggerForCommand("reset")).toBe("reset-requested");
  });

  it("returns worktree-removed for worktree-remove", () => {
    expect(getTriggerForCommand("worktree-remove")).toBe("worktree-removed");
  });

  it("returns null for unknown commands", () => {
    expect(getTriggerForCommand("run")).toBeNull();
    expect(getTriggerForCommand("list")).toBeNull();
    expect(getTriggerForCommand("")).toBeNull();
  });
});
