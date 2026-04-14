import { describe, expect, it } from "vite-plus/test";
import { formatToolCall } from "../../src/utils/tool-formatter.ts";

describe("formatToolCall", () => {
  it("formats Bash with command", () => {
    expect(formatToolCall("Bash", { command: "git status" })).toBe("BASH: git status");
  });

  it("formats Read with file_path", () => {
    expect(formatToolCall("Read", { file_path: "src/index.ts" })).toBe("READ: src/index.ts");
  });

  it("formats Edit with file_path", () => {
    expect(formatToolCall("Edit", { file_path: "src/utils.ts" })).toBe("EDIT: src/utils.ts");
  });

  it("formats Grep with pattern", () => {
    expect(formatToolCall("Grep", { pattern: "TODO" })).toBe("GREP: /TODO/");
  });

  it("formats Glob with pattern", () => {
    expect(formatToolCall("Glob", { pattern: "**/*.ts" })).toBe("GLOB: **/*.ts");
  });

  it("formats unknown tool with no input", () => {
    expect(formatToolCall("CustomTool")).toBe("CUSTOMTOOL");
  });

  it("formats unknown tool with unrecognized input keys", () => {
    expect(formatToolCall("CustomTool", { foo: "bar" })).toBe("CUSTOMTOOL");
  });

  it("truncates long Bash commands at 80 characters", () => {
    const longCommand = "a".repeat(100);
    const result = formatToolCall("Bash", { command: longCommand });
    expect(result).toBe(`BASH: ${"a".repeat(80)}...`);
  });

  it("uses first line of multiline Bash commands", () => {
    const result = formatToolCall("Bash", { command: "echo hello\necho world" });
    expect(result).toBe("BASH: echo hello");
  });
});
