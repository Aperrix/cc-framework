import { describe, expect, it } from "vite-plus/test";
import { extractCode, buildCodeModeSystemPrompt } from "../../src/runners/code-mode-runner.ts";

describe("extractCode", () => {
  it("extracts code from TypeScript fences", () => {
    const input = "Here's the code:\n```typescript\nconsole.log('hello');\n```\nDone.";
    expect(extractCode(input)).toBe("console.log('hello');");
  });

  it("extracts code from plain fences", () => {
    const input = "```\necho hello\n```";
    expect(extractCode(input)).toBe("echo hello");
  });

  it("returns raw output when no fences present", () => {
    const input = "console.log('hello');";
    expect(extractCode(input)).toBe("console.log('hello');");
  });

  it("handles python fences", () => {
    const input = "```python\nprint('hello')\n```";
    expect(extractCode(input)).toBe("print('hello')");
  });

  it("handles bash fences", () => {
    const input = "```bash\necho hello\n```";
    expect(extractCode(input)).toBe("echo hello");
  });

  it("handles multiline code in fences", () => {
    const input = "```typescript\nconst x = 1;\nconst y = 2;\nconsole.log(x + y);\n```";
    expect(extractCode(input)).toBe("const x = 1;\nconst y = 2;\nconsole.log(x + y);");
  });

  it("trims whitespace from unfenced output", () => {
    const input = "  \nconsole.log('hello');\n  ";
    expect(extractCode(input)).toBe("console.log('hello');");
  });
});

describe("buildCodeModeSystemPrompt", () => {
  it("includes runtime description for bun", () => {
    const prompt = buildCodeModeSystemPrompt("bun", {});
    expect(prompt).toContain("TypeScript");
    expect(prompt).toContain("Bun");
  });

  it("includes runtime description for bash", () => {
    const prompt = buildCodeModeSystemPrompt("bash", {});
    expect(prompt).toContain("Bash shell script");
  });

  it("includes runtime description for uv", () => {
    const prompt = buildCodeModeSystemPrompt("uv", {});
    expect(prompt).toContain("Python");
  });

  it("includes environment variables", () => {
    const prompt = buildCodeModeSystemPrompt("bash", {
      ARTIFACTS_DIR: "/tmp/artifacts",
      WORKFLOW_ID: "run-123",
    });
    expect(prompt).toContain("ARTIFACTS_DIR");
    expect(prompt).toContain("/tmp/artifacts");
    expect(prompt).toContain("WORKFLOW_ID");
  });

  it("instructs no markdown fences", () => {
    const prompt = buildCodeModeSystemPrompt("uv", {});
    expect(prompt).toContain("ONLY the executable code");
  });

  it("instructs to handle errors gracefully", () => {
    const prompt = buildCodeModeSystemPrompt("bun", {});
    expect(prompt).toContain("Handle errors gracefully");
  });
});
