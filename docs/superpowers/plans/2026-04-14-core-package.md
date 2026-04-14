# cc-framework Core Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/core` — the workflow engine that parses YAML workflows, builds DAGs, executes nodes via the Claude Agent SDK, and persists state in SQLite.

**Architecture:** Bottom-up build: Zod schemas define the workflow format, the parser loads YAML and validates it, the DAG module computes execution order, the variable module resolves substitutions, the store persists state in SQLite, node runners execute each type, and the executor orchestrates everything layer by layer. An event emitter lets consumers (MCP, Web UI) observe progress.

**Tech Stack:** TypeScript, Vite+ (vp), Zod, yaml (npm), better-sqlite3, zod-to-json-schema, @anthropic-ai/claude-agent-sdk

---

## File Structure

```
packages/core/
├── package.json
├── vite.config.ts
├── src/
│   ├── index.ts                    # Public API barrel export
│   ├── schema/
│   │   ├── workflow.ts             # Zod schema for top-level workflow properties
│   │   ├── node.ts                 # Zod schema for node types (discriminated union)
│   │   ├── common.ts               # Shared Zod types (trigger_rule, when condition, etc.)
│   │   └── generate-json-schema.ts # Script to emit workflow.schema.json
│   ├── parser/
│   │   ├── parse-workflow.ts       # YAML loading + Zod validation + prompt file resolution
│   │   └── resolve-prompt.ts       # String-or-path detection and file loading
│   ├── dag/
│   │   └── build-dag.ts            # Topological sort, cycle detection, parallel layers
│   ├── variables/
│   │   └── substitute.ts           # $nodeId.output, $ARGUMENTS, etc.
│   ├── store/
│   │   ├── database.ts             # SQLite connection + migrations
│   │   └── queries.ts              # CRUD for runs, node_executions, outputs, events, etc.
│   ├── runners/
│   │   ├── ai-runner.ts            # Claude Agent SDK query() wrapper
│   │   ├── shell-runner.ts         # Bash execution via child_process
│   │   ├── loop-runner.ts          # Iterates ai-runner until signal
│   │   ├── approval-runner.ts      # Pauses and waits for human input
│   │   └── cancel-runner.ts        # Stops the workflow
│   ├── executor/
│   │   └── executor.ts             # DAG traversal, layer-by-layer parallel execution
│   ├── isolation/
│   │   └── isolation.ts            # Git worktree/branch setup and cleanup
│   └── events/
│       └── event-bus.ts            # Typed EventEmitter for node:start, node:complete, etc.
└── tests/
    ├── schema/
    │   ├── workflow.test.ts
    │   └── node.test.ts
    ├── parser/
    │   ├── parse-workflow.test.ts
    │   └── resolve-prompt.test.ts
    ├── dag/
    │   └── build-dag.test.ts
    ├── variables/
    │   └── substitute.test.ts
    ├── store/
    │   ├── database.test.ts
    │   └── queries.test.ts
    ├── runners/
    │   ├── shell-runner.test.ts
    │   └── loop-runner.test.ts
    ├── executor/
    │   └── executor.test.ts
    └── fixtures/
        ├── minimal.yaml
        ├── parallel.yaml
        ├── conditional.yaml
        ├── loop.yaml
        └── prompts/
            └── investigate.md
```

---

### Task 1: Scaffold the monorepo and packages/core

**Files:**

- Create: `packages/core/package.json`
- Create: `packages/core/vite.config.ts`
- Create: `packages/core/src/index.ts`
- Modify: `package.json` (root)
- Modify: `tsconfig.json` (root)

- [ ] **Step 1: Remove placeholder packages**

```bash
rm -rf packages/utils apps/website
```

- [ ] **Step 2: Update root package.json**

Remove the `dev` script (referenced `website#dev`), keep workspaces:

```bash
vp run -- node -e "
const pkg = require('./package.json');
delete pkg.scripts.dev;
require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
```

- [ ] **Step 3: Create packages/core/package.json**

```json
{
  "name": "@cc-framework/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vp test",
    "build": "vp build"
  },
  "dependencies": {
    "yaml": "^2.7.0",
    "zod": "^3.25.0",
    "better-sqlite3": "^11.8.0",
    "zod-to-json-schema": "^3.24.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "vite-plus": "catalog:"
  }
}
```

- [ ] **Step 4: Create packages/core/vite.config.ts**

```typescript
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {},
});
```

- [ ] **Step 5: Create packages/core/src/index.ts**

```typescript
// Public API — will be populated as modules are built
export {};
```

- [ ] **Step 6: Install dependencies**

```bash
vp install
```

- [ ] **Step 7: Verify setup**

```bash
vp test --passWithNoTests
```

Expected: PASS (no tests yet)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "scaffold: initialize packages/core with dependencies"
```

---

### Task 2: Zod schemas — common types

**Files:**

- Create: `packages/core/src/schema/common.ts`
- Create: `packages/core/tests/schema/common.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/tests/schema/common.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/core && vp test tests/schema/common.test.ts
```

Expected: FAIL — modules not found

- [ ] **Step 3: Implement common schemas**

```typescript
// packages/core/src/schema/common.ts
import { z } from "zod";

export const TriggerRuleSchema = z.enum([
  "all_success",
  "one_success",
  "none_failed_min_one_success",
  "all_done",
]);
export type TriggerRule = z.infer<typeof TriggerRuleSchema>;

export const WhenConditionSchema = z.string().min(1);
export type WhenCondition = z.infer<typeof WhenConditionSchema>;

export const RetrySchema = z.object({
  max_attempts: z.number().int().min(1),
  delay_ms: z.number().int().min(0).default(3000),
  on_error: z.enum(["transient", "all"]).default("transient"),
});
export type Retry = z.infer<typeof RetrySchema>;

export const IsolationSchema = z.object({
  strategy: z.enum(["worktree", "branch"]),
  branch_prefix: z.string().default("ccf/"),
});
export type Isolation = z.infer<typeof IsolationSchema>;

export const InputDefinitionSchema = z.object({
  type: z.enum(["string", "number", "boolean"]),
  required: z.boolean().default(false),
  description: z.string().optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
});
export type InputDefinition = z.infer<typeof InputDefinitionSchema>;

export const OutputFormatSchema = z.object({
  type: z.literal("object"),
  properties: z.record(z.any()),
  required: z.array(z.string()).optional(),
});
export type OutputFormat = z.infer<typeof OutputFormatSchema>;

export const SandboxSchema = z.object({
  enabled: z.boolean().default(false),
  filesystem: z
    .object({
      denyWrite: z.array(z.string()).optional(),
    })
    .optional(),
  network: z
    .object({
      allowedDomains: z.array(z.string()).optional(),
      allowManagedDomainsOnly: z.boolean().optional(),
    })
    .optional(),
});
export type Sandbox = z.infer<typeof SandboxSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && vp test tests/schema/common.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/schema/common.ts packages/core/tests/schema/common.test.ts
git commit -m "feat(core): add common Zod schemas (trigger rules, retry, isolation, etc.)"
```

---

### Task 3: Zod schemas — node types

**Files:**

- Create: `packages/core/src/schema/node.ts`
- Create: `packages/core/tests/schema/node.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/tests/schema/node.test.ts
import { describe, expect, it } from "vite-plus/test";
import { NodeSchema } from "../../src/schema/node.ts";

describe("NodeSchema", () => {
  it("accepts a prompt node with inline text", () => {
    const node = NodeSchema.parse({ id: "plan", prompt: "Create a plan" });
    expect(node.id).toBe("plan");
    expect(node.prompt).toBe("Create a plan");
  });

  it("accepts a prompt node with file path", () => {
    const node = NodeSchema.parse({ id: "plan", prompt: "investigate.md" });
    expect(node.prompt).toBe("investigate.md");
  });

  it("accepts a bash node", () => {
    const node = NodeSchema.parse({ id: "test", bash: "npm test" });
    expect(node.bash).toBe("npm test");
  });

  it("accepts a loop node", () => {
    const node = NodeSchema.parse({
      id: "impl",
      loop: { prompt: "Implement the next task", until: "COMPLETE", max_iterations: 10 },
    });
    expect(node.loop?.prompt).toBe("Implement the next task");
    expect(node.loop?.until).toBe("COMPLETE");
    expect(node.loop?.max_iterations).toBe(10);
  });

  it("accepts an approval node", () => {
    const node = NodeSchema.parse({
      id: "review",
      approval: { message: "Review and approve" },
    });
    expect(node.approval?.message).toBe("Review and approve");
  });

  it("accepts a cancel node", () => {
    const node = NodeSchema.parse({ id: "stop", cancel: "Conflicts detected" });
    expect(node.cancel).toBe("Conflicts detected");
  });

  it("rejects a node with no type", () => {
    expect(() => NodeSchema.parse({ id: "empty" })).toThrow();
  });

  it("rejects a node with multiple types", () => {
    expect(() => NodeSchema.parse({ id: "bad", prompt: "text", bash: "cmd" })).toThrow();
  });

  it("accepts common properties", () => {
    const node = NodeSchema.parse({
      id: "impl",
      prompt: "Implement it",
      depends_on: ["plan"],
      when: "$plan.output.ready == 'true'",
      trigger_rule: "all_success",
      context: "fresh",
      model: "opus",
      allowed_tools: ["Read", "Edit"],
      retry: { max_attempts: 2 },
    });
    expect(node.depends_on).toEqual(["plan"]);
    expect(node.context).toBe("fresh");
    expect(node.model).toBe("opus");
    expect(node.allowed_tools).toEqual(["Read", "Edit"]);
    expect(node.retry?.max_attempts).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/core && vp test tests/schema/node.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement node schema**

```typescript
// packages/core/src/schema/node.ts
import { z } from "zod";
import {
  TriggerRuleSchema,
  WhenConditionSchema,
  RetrySchema,
  OutputFormatSchema,
  SandboxSchema,
} from "./common.ts";

const LoopConfigSchema = z.object({
  prompt: z.string().min(1),
  until: z.string().min(1),
  max_iterations: z.number().int().min(1).default(15),
  fresh_context: z.boolean().default(false),
  interactive: z.boolean().default(false),
  gate_message: z.string().optional(),
});

const ApprovalConfigSchema = z.object({
  message: z.string().min(1),
  capture_response: z.boolean().default(false),
  on_reject: z
    .object({
      prompt: z.string().min(1),
      max_attempts: z.number().int().min(1).default(3),
    })
    .optional(),
});

const NodeBaseSchema = z.object({
  id: z.string().min(1),
  depends_on: z.array(z.string()).default([]),
  when: WhenConditionSchema.optional(),
  trigger_rule: TriggerRuleSchema.default("all_success"),
  context: z.enum(["fresh", "shared"]).default("fresh"),
  idle_timeout: z.number().int().min(0).optional(),
  retry: RetrySchema.optional(),
  // AI-specific properties (ignored by non-AI nodes)
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
  effort: z.enum(["low", "medium", "high", "max"]).optional(),
  thinking: z.union([z.literal("adaptive"), z.literal("disabled")]).optional(),
  fallbackModel: z.string().optional(),
  betas: z.array(z.string()).optional(),
  output_format: OutputFormatSchema.optional(),
  allowed_tools: z.array(z.string()).optional(),
  denied_tools: z.array(z.string()).optional(),
  sandbox: SandboxSchema.optional(),
  hooks: z.record(z.any()).optional(),
  mcp: z.string().optional(),
  skills: z.array(z.string()).optional(),
});

const NodeTypesSchema = z.object({
  prompt: z.string().min(1).optional(),
  bash: z.string().min(1).optional(),
  loop: LoopConfigSchema.optional(),
  approval: ApprovalConfigSchema.optional(),
  cancel: z.string().min(1).optional(),
});

export const NodeSchema = NodeBaseSchema.merge(NodeTypesSchema).superRefine((data, ctx) => {
  const types = [data.prompt, data.bash, data.loop, data.approval, data.cancel];
  const defined = types.filter((t) => t !== undefined);
  if (defined.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Node must have exactly one type: prompt, bash, loop, approval, or cancel",
    });
  }
  if (defined.length > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Node must have exactly one type — found multiple",
    });
  }
});

export type Node = z.infer<typeof NodeSchema>;
export type LoopConfig = z.infer<typeof LoopConfigSchema>;
export type ApprovalConfig = z.infer<typeof ApprovalConfigSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && vp test tests/schema/node.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/schema/node.ts packages/core/tests/schema/node.test.ts
git commit -m "feat(core): add node Zod schema with discriminated union validation"
```

---

### Task 4: Zod schemas — workflow top-level + JSON Schema generation

**Files:**

- Create: `packages/core/src/schema/workflow.ts`
- Create: `packages/core/src/schema/generate-json-schema.ts`
- Create: `packages/core/tests/schema/workflow.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/tests/schema/workflow.test.ts
import { describe, expect, it } from "vite-plus/test";
import { WorkflowSchema } from "../../src/schema/workflow.ts";

describe("WorkflowSchema", () => {
  it("parses a minimal workflow", () => {
    const wf = WorkflowSchema.parse({
      name: "test-workflow",
      nodes: [{ id: "step1", prompt: "Do something" }],
    });
    expect(wf.name).toBe("test-workflow");
    expect(wf.nodes).toHaveLength(1);
  });

  it("parses a full workflow with all top-level properties", () => {
    const wf = WorkflowSchema.parse({
      name: "full-workflow",
      description: "A complete workflow",
      model: "opus",
      effort: "high",
      thinking: "adaptive",
      isolation: { strategy: "worktree" },
      inputs: {
        issue: { type: "string", required: true, description: "Issue number" },
      },
      nodes: [
        { id: "investigate", prompt: "Investigate issue" },
        { id: "fix", prompt: "Fix the bug", depends_on: ["investigate"] },
      ],
    });
    expect(wf.description).toBe("A complete workflow");
    expect(wf.model).toBe("opus");
    expect(wf.isolation?.strategy).toBe("worktree");
    expect(wf.inputs?.issue.type).toBe("string");
    expect(wf.nodes).toHaveLength(2);
  });

  it("rejects a workflow with no name", () => {
    expect(() => WorkflowSchema.parse({ nodes: [{ id: "s", prompt: "p" }] })).toThrow();
  });

  it("rejects a workflow with no nodes", () => {
    expect(() => WorkflowSchema.parse({ name: "empty" })).toThrow();
  });

  it("rejects a workflow with empty nodes", () => {
    expect(() => WorkflowSchema.parse({ name: "empty", nodes: [] })).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/core && vp test tests/schema/workflow.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement workflow schema**

```typescript
// packages/core/src/schema/workflow.ts
import { z } from "zod";
import { NodeSchema } from "./node.ts";
import { IsolationSchema, InputDefinitionSchema, SandboxSchema } from "./common.ts";

export const WorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  model: z.string().optional(),
  interactive: z.boolean().default(false),
  effort: z.enum(["low", "medium", "high", "max"]).optional(),
  thinking: z.union([z.literal("adaptive"), z.literal("disabled")]).optional(),
  fallbackModel: z.string().optional(),
  betas: z.array(z.string()).optional(),
  sandbox: SandboxSchema.optional(),
  isolation: IsolationSchema.optional(),
  inputs: z.record(InputDefinitionSchema).optional(),
  nodes: z.array(NodeSchema).min(1),
});

export type Workflow = z.infer<typeof WorkflowSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && vp test tests/schema/workflow.test.ts
```

Expected: PASS

- [ ] **Step 5: Create JSON Schema generator**

```typescript
// packages/core/src/schema/generate-json-schema.ts
import { zodToJsonSchema } from "zod-to-json-schema";
import { WorkflowSchema } from "./workflow.ts";

export function generateWorkflowJsonSchema(): Record<string, unknown> {
  return zodToJsonSchema(WorkflowSchema, {
    name: "CCFrameworkWorkflow",
    $refStrategy: "none",
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/schema/workflow.ts packages/core/src/schema/generate-json-schema.ts packages/core/tests/schema/workflow.test.ts
git commit -m "feat(core): add workflow schema and JSON Schema generator"
```

---

### Task 5: Parser — prompt resolution and YAML loading

**Files:**

- Create: `packages/core/src/parser/resolve-prompt.ts`
- Create: `packages/core/src/parser/parse-workflow.ts`
- Create: `packages/core/tests/parser/resolve-prompt.test.ts`
- Create: `packages/core/tests/parser/parse-workflow.test.ts`
- Create: `packages/core/tests/fixtures/minimal.yaml`
- Create: `packages/core/tests/fixtures/prompts/investigate.md`

- [ ] **Step 1: Create test fixtures**

```yaml
# packages/core/tests/fixtures/minimal.yaml
name: minimal-test
nodes:
  - id: greet
    prompt: "Say hello"
```

```markdown
<!-- packages/core/tests/fixtures/prompts/investigate.md -->

# Investigate Issue

Investigate the reported issue. Read the issue description, identify affected files, and output a root cause summary.
```

- [ ] **Step 2: Write resolve-prompt tests**

```typescript
// packages/core/tests/parser/resolve-prompt.test.ts
import { describe, expect, it } from "vite-plus/test";
import { resolvePrompt } from "../../src/parser/resolve-prompt.ts";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures");

describe("resolvePrompt", () => {
  it("returns inline text as-is", async () => {
    const result = await resolvePrompt("Say hello", fixturesDir);
    expect(result).toBe("Say hello");
  });

  it("loads a .md file from prompts dir", async () => {
    const result = await resolvePrompt("investigate.md", fixturesDir);
    expect(result).toContain("# Investigate Issue");
    expect(result).toContain("root cause summary");
  });

  it("loads a relative path", async () => {
    const result = await resolvePrompt("./prompts/investigate.md", fixturesDir);
    expect(result).toContain("# Investigate Issue");
  });

  it("throws for a missing file", async () => {
    await expect(resolvePrompt("nonexistent.md", fixturesDir)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd packages/core && vp test tests/parser/resolve-prompt.test.ts
```

Expected: FAIL

- [ ] **Step 4: Implement resolve-prompt**

```typescript
// packages/core/src/parser/resolve-prompt.ts
import { readFile } from "node:fs/promises";
import { join, isAbsolute } from "node:path";

function isFilePath(value: string): boolean {
  return value.endsWith(".md") || value.startsWith("./") || value.startsWith("/");
}

export async function resolvePrompt(value: string, projectRoot: string): Promise<string> {
  if (!isFilePath(value)) {
    return value;
  }

  if (isAbsolute(value)) {
    return readFile(value, "utf-8");
  }

  // Try .cc-framework/prompts/ first, then relative to project root
  const promptsDir = join(projectRoot, "prompts");
  const candidates = [join(promptsDir, value), join(projectRoot, value)];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf-8");
    } catch {
      continue;
    }
  }

  throw new Error(`Prompt file not found: "${value}" (searched in ${candidates.join(", ")})`);
}
```

- [ ] **Step 5: Run resolve-prompt tests**

```bash
cd packages/core && vp test tests/parser/resolve-prompt.test.ts
```

Expected: PASS

- [ ] **Step 6: Write parse-workflow tests**

```typescript
// packages/core/tests/parser/parse-workflow.test.ts
import { describe, expect, it } from "vite-plus/test";
import { parseWorkflow } from "../../src/parser/parse-workflow.ts";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures");

describe("parseWorkflow", () => {
  it("parses a valid YAML file", async () => {
    const wf = await parseWorkflow(join(fixturesDir, "minimal.yaml"), fixturesDir);
    expect(wf.name).toBe("minimal-test");
    expect(wf.nodes).toHaveLength(1);
    expect(wf.nodes[0].id).toBe("greet");
    expect(wf.nodes[0].prompt).toBe("Say hello");
  });

  it("throws on invalid YAML content", async () => {
    await expect(parseWorkflow("not-a-real-file.yaml", fixturesDir)).rejects.toThrow();
  });
});
```

- [ ] **Step 7: Implement parse-workflow**

```typescript
// packages/core/src/parser/parse-workflow.ts
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { WorkflowSchema, type Workflow } from "../schema/workflow.ts";
import { resolvePrompt } from "./resolve-prompt.ts";

export async function parseWorkflow(filePath: string, projectRoot: string): Promise<Workflow> {
  const raw = await readFile(filePath, "utf-8");
  const data = parseYaml(raw);
  const workflow = WorkflowSchema.parse(data);

  // Resolve prompt file references
  for (const node of workflow.nodes) {
    if (node.prompt !== undefined) {
      node.prompt = await resolvePrompt(node.prompt, projectRoot);
    }
    if (node.loop?.prompt !== undefined) {
      node.loop.prompt = await resolvePrompt(node.loop.prompt, projectRoot);
    }
  }

  return workflow;
}
```

- [ ] **Step 8: Run all parser tests**

```bash
cd packages/core && vp test tests/parser/
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/parser/ packages/core/tests/parser/ packages/core/tests/fixtures/
git commit -m "feat(core): add YAML parser with prompt file resolution"
```

---

### Task 6: DAG builder — topological sort and parallel layers

**Files:**

- Create: `packages/core/src/dag/build-dag.ts`
- Create: `packages/core/tests/dag/build-dag.test.ts`
- Create: `packages/core/tests/fixtures/parallel.yaml`
- Create: `packages/core/tests/fixtures/conditional.yaml`

- [ ] **Step 1: Create test fixtures**

```yaml
# packages/core/tests/fixtures/parallel.yaml
name: parallel-test
nodes:
  - id: scope
    prompt: "Create scope"
  - id: review-a
    prompt: "Review A"
    depends_on: [scope]
  - id: review-b
    prompt: "Review B"
    depends_on: [scope]
  - id: synthesize
    prompt: "Synthesize"
    depends_on: [review-a, review-b]
```

```yaml
# packages/core/tests/fixtures/conditional.yaml
name: conditional-test
nodes:
  - id: classify
    prompt: "Classify the issue"
  - id: simple-fix
    prompt: "Quick fix"
    depends_on: [classify]
    when: "$classify.output.type == 'simple'"
  - id: deep-fix
    prompt: "Deep investigation"
    depends_on: [classify]
    when: "$classify.output.type == 'complex'"
```

- [ ] **Step 2: Write the failing tests**

```typescript
// packages/core/tests/dag/build-dag.test.ts
import { describe, expect, it } from "vite-plus/test";
import { buildDag, type DagLayer } from "../../src/dag/build-dag.ts";
import type { Node } from "../../src/schema/node.ts";

function makeNode(id: string, deps: string[] = []): Node {
  return {
    id,
    prompt: `Do ${id}`,
    depends_on: deps,
    trigger_rule: "all_success",
    context: "fresh",
  } as Node;
}

describe("buildDag", () => {
  it("puts independent nodes in the same layer", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const layers = buildDag(nodes);
    expect(layers).toHaveLength(1);
    expect(layers[0].nodeIds).toEqual(expect.arrayContaining(["a", "b", "c"]));
  });

  it("builds sequential layers from dependencies", () => {
    const nodes = [makeNode("a"), makeNode("b", ["a"]), makeNode("c", ["b"])];
    const layers = buildDag(nodes);
    expect(layers).toHaveLength(3);
    expect(layers[0].nodeIds).toEqual(["a"]);
    expect(layers[1].nodeIds).toEqual(["b"]);
    expect(layers[2].nodeIds).toEqual(["c"]);
  });

  it("groups parallel nodes in the same layer", () => {
    const nodes = [
      makeNode("scope"),
      makeNode("review-a", ["scope"]),
      makeNode("review-b", ["scope"]),
      makeNode("synthesize", ["review-a", "review-b"]),
    ];
    const layers = buildDag(nodes);
    expect(layers).toHaveLength(3);
    expect(layers[0].nodeIds).toEqual(["scope"]);
    expect(layers[1].nodeIds).toEqual(expect.arrayContaining(["review-a", "review-b"]));
    expect(layers[2].nodeIds).toEqual(["synthesize"]);
  });

  it("detects cycles", () => {
    const nodes = [makeNode("a", ["b"]), makeNode("b", ["a"])];
    expect(() => buildDag(nodes)).toThrow(/cycle/i);
  });

  it("detects missing dependencies", () => {
    const nodes = [makeNode("a", ["nonexistent"])];
    expect(() => buildDag(nodes)).toThrow(/nonexistent/i);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd packages/core && vp test tests/dag/build-dag.test.ts
```

Expected: FAIL

- [ ] **Step 4: Implement the DAG builder**

```typescript
// packages/core/src/dag/build-dag.ts
import type { Node } from "../schema/node.ts";

export interface DagLayer {
  nodeIds: string[];
}

export function buildDag(nodes: Node[]): DagLayer[] {
  const nodeMap = new Map<string, Node>();
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    dependents.set(node.id, []);
  }

  for (const node of nodes) {
    for (const dep of node.depends_on) {
      if (!nodeMap.has(dep)) {
        throw new Error(`Node "${node.id}" depends on "${dep}" which does not exist`);
      }
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
      dependents.get(dep)!.push(node.id);
    }
  }

  const layers: DagLayer[] = [];
  const remaining = new Set(nodes.map((n) => n.id));

  while (remaining.size > 0) {
    const ready: string[] = [];
    for (const id of remaining) {
      if (inDegree.get(id) === 0) {
        ready.push(id);
      }
    }

    if (ready.length === 0) {
      throw new Error(`Cycle detected in DAG — remaining nodes: ${[...remaining].join(", ")}`);
    }

    layers.push({ nodeIds: ready });

    for (const id of ready) {
      remaining.delete(id);
      for (const dependent of dependents.get(id)!) {
        inDegree.set(dependent, inDegree.get(dependent)! - 1);
      }
    }
  }

  return layers;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/core && vp test tests/dag/build-dag.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/dag/ packages/core/tests/dag/ packages/core/tests/fixtures/parallel.yaml packages/core/tests/fixtures/conditional.yaml
git commit -m "feat(core): add DAG builder with topological sort and cycle detection"
```

---

### Task 7: Variable substitution

**Files:**

- Create: `packages/core/src/variables/substitute.ts`
- Create: `packages/core/tests/variables/substitute.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/tests/variables/substitute.test.ts
import { describe, expect, it } from "vite-plus/test";
import { substituteVariables } from "../../src/variables/substitute.ts";

describe("substituteVariables", () => {
  it("replaces $ARGUMENTS", () => {
    const result = substituteVariables("Fix issue $ARGUMENTS", {
      ARGUMENTS: "#42",
    });
    expect(result).toBe("Fix issue #42");
  });

  it("replaces $USER_MESSAGE as alias for $ARGUMENTS", () => {
    const result = substituteVariables("Task: $USER_MESSAGE", {
      ARGUMENTS: "fix the bug",
    });
    expect(result).toBe("Task: fix the bug");
  });

  it("replaces $WORKFLOW_ID", () => {
    const result = substituteVariables("Run $WORKFLOW_ID", {
      WORKFLOW_ID: "run-abc",
    });
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
      {
        plan: { output: "Step 1: do this" },
      },
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/core && vp test tests/variables/substitute.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement variable substitution**

```typescript
// packages/core/src/variables/substitute.ts

interface NodeOutput {
  output: string;
}

const BUILTIN_ALIASES: Record<string, string> = {
  USER_MESSAGE: "ARGUMENTS",
};

export function substituteVariables(
  text: string,
  builtins: Record<string, string>,
  nodeOutputs: Record<string, NodeOutput> = {},
): string {
  // Resolve aliases
  const resolved: Record<string, string> = { ...builtins };
  for (const [alias, target] of Object.entries(BUILTIN_ALIASES)) {
    if (resolved[target] !== undefined) {
      resolved[alias] = resolved[target];
    }
  }

  let result = text;

  // Replace $nodeId.output.field (JSON extraction) — must come before $nodeId.output
  result = result.replace(/\$(\w+)\.output\.(\w+)/g, (match, nodeId: string, field: string) => {
    const node = nodeOutputs[nodeId];
    if (!node) return match;
    try {
      const parsed = JSON.parse(node.output);
      return parsed[field] !== undefined ? String(parsed[field]) : match;
    } catch {
      return match;
    }
  });

  // Replace $nodeId.output (full output)
  result = result.replace(/\$(\w+)\.output(?!\.\w)/g, (match, nodeId: string) => {
    const node = nodeOutputs[nodeId];
    return node ? node.output : match;
  });

  // Replace $BUILTIN variables
  result = result.replace(/\$([A-Z_]+)/g, (match, name: string) => {
    return resolved[name] !== undefined ? resolved[name] : match;
  });

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && vp test tests/variables/substitute.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/variables/ packages/core/tests/variables/
git commit -m "feat(core): add variable substitution ($nodeId.output, $ARGUMENTS, etc.)"
```

---

### Task 8: Event bus

**Files:**

- Create: `packages/core/src/events/event-bus.ts`

- [ ] **Step 1: Implement the typed event bus**

```typescript
// packages/core/src/events/event-bus.ts
import { EventEmitter } from "node:events";

export interface NodeStartEvent {
  runId: string;
  nodeId: string;
  attempt: number;
}

export interface NodeCompleteEvent {
  runId: string;
  nodeId: string;
  output: string;
  durationMs: number;
}

export interface NodeErrorEvent {
  runId: string;
  nodeId: string;
  error: string;
  attempt: number;
}

export interface NodeSkippedEvent {
  runId: string;
  nodeId: string;
  reason: string;
}

export interface RunProgressEvent {
  runId: string;
  completedNodes: number;
  totalNodes: number;
}

export interface RunDoneEvent {
  runId: string;
  status: "completed" | "failed" | "cancelled";
  durationMs: number;
}

export interface ApprovalRequestEvent {
  runId: string;
  nodeId: string;
  message: string;
}

interface EventMap {
  "node:start": [NodeStartEvent];
  "node:complete": [NodeCompleteEvent];
  "node:error": [NodeErrorEvent];
  "node:skipped": [NodeSkippedEvent];
  "run:progress": [RunProgressEvent];
  "run:done": [RunDoneEvent];
  "approval:request": [ApprovalRequestEvent];
}

export class WorkflowEventBus extends EventEmitter<EventMap> {}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/events/
git commit -m "feat(core): add typed WorkflowEventBus"
```

---

### Task 9: SQLite store — database and migrations

**Files:**

- Create: `packages/core/src/store/database.ts`
- Create: `packages/core/tests/store/database.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/tests/store/database.test.ts
import { describe, expect, it, afterEach } from "vite-plus/test";
import { createDatabase, type Database } from "../../src/store/database.ts";

describe("createDatabase", () => {
  let db: Database;

  afterEach(() => {
    db?.close();
  });

  it("creates an in-memory database with all tables", () => {
    db = createDatabase(":memory:");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("workflows");
    expect(names).toContain("runs");
    expect(names).toContain("node_executions");
    expect(names).toContain("outputs");
    expect(names).toContain("events");
    expect(names).toContain("artifacts");
    expect(names).toContain("isolation_environments");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/core && vp test tests/store/database.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement database creation with migrations**

```typescript
// packages/core/src/store/database.ts
import BetterSqlite3 from "better-sqlite3";

export type Database = BetterSqlite3.Database;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('embedded', 'custom')),
    yaml_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id),
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
    arguments TEXT,
    branch TEXT,
    worktree_path TEXT,
    started_at INTEGER NOT NULL,
    finished_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS node_executions (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id),
    node_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
    attempt INTEGER NOT NULL DEFAULT 1,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    duration_ms INTEGER
  );

  CREATE TABLE IF NOT EXISTS outputs (
    id TEXT PRIMARY KEY,
    node_execution_id TEXT NOT NULL REFERENCES node_executions(id),
    content TEXT NOT NULL,
    exit_code INTEGER
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id),
    node_id TEXT,
    type TEXT NOT NULL,
    payload TEXT,
    timestamp INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id),
    node_id TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS isolation_environments (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id),
    strategy TEXT NOT NULL CHECK (strategy IN ('worktree', 'branch')),
    branch_name TEXT NOT NULL,
    worktree_path TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'cleaned_up', 'orphaned')),
    created_at INTEGER NOT NULL,
    cleaned_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_runs_workflow ON runs(workflow_id);
  CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
  CREATE INDEX IF NOT EXISTS idx_node_executions_run ON node_executions(run_id);
  CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id);
`;

export function createDatabase(path: string): Database {
  const db = new BetterSqlite3(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && vp test tests/store/database.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/store/database.ts packages/core/tests/store/database.test.ts
git commit -m "feat(core): add SQLite store with schema migrations"
```

---

### Task 10: SQLite store — queries (CRUD)

**Files:**

- Create: `packages/core/src/store/queries.ts`
- Create: `packages/core/tests/store/queries.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/tests/store/queries.test.ts
import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { createDatabase, type Database } from "../../src/store/database.ts";
import { StoreQueries } from "../../src/store/queries.ts";

describe("StoreQueries", () => {
  let db: Database;
  let store: StoreQueries;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
  });

  afterEach(() => {
    db.close();
  });

  it("creates and retrieves a workflow", () => {
    const id = store.upsertWorkflow("test-wf", "custom", "hash123");
    const wf = store.getWorkflow(id);
    expect(wf).not.toBeNull();
    expect(wf!.name).toBe("test-wf");
    expect(wf!.source).toBe("custom");
  });

  it("creates and retrieves a run", () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash123");
    const runId = store.createRun(wfId, '{"issue": "42"}');
    const run = store.getRun(runId);
    expect(run).not.toBeNull();
    expect(run!.status).toBe("pending");
    expect(run!.arguments).toBe('{"issue": "42"}');
  });

  it("updates run status", () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash123");
    const runId = store.createRun(wfId);
    store.updateRunStatus(runId, "running");
    expect(store.getRun(runId)!.status).toBe("running");
    store.updateRunStatus(runId, "completed");
    expect(store.getRun(runId)!.status).toBe("completed");
  });

  it("creates and retrieves node executions", () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash123");
    const runId = store.createRun(wfId);
    const execId = store.createNodeExecution(runId, "investigate", 1);
    const exec = store.getNodeExecution(execId);
    expect(exec).not.toBeNull();
    expect(exec!.node_id).toBe("investigate");
    expect(exec!.attempt).toBe(1);
    expect(exec!.status).toBe("pending");
  });

  it("saves and retrieves node output", () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash123");
    const runId = store.createRun(wfId);
    const execId = store.createNodeExecution(runId, "test-node", 1);
    store.saveOutput(execId, "The answer is 42", null);
    const output = store.getOutput(execId);
    expect(output).not.toBeNull();
    expect(output!.content).toBe("The answer is 42");
  });

  it("records and retrieves events", () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash123");
    const runId = store.createRun(wfId);
    store.recordEvent(runId, "investigate", "start", "{}");
    store.recordEvent(runId, "investigate", "complete", '{"duration": 5000}');
    const events = store.getEvents(runId);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("start");
    expect(events[1].type).toBe("complete");
  });

  it("gets completed node outputs for a run", () => {
    const wfId = store.upsertWorkflow("test-wf", "custom", "hash123");
    const runId = store.createRun(wfId);
    const execId = store.createNodeExecution(runId, "plan", 1);
    store.updateNodeExecutionStatus(execId, "completed", 1500);
    store.saveOutput(execId, "The plan is ready");
    const outputs = store.getNodeOutputs(runId);
    expect(outputs.plan).toBeDefined();
    expect(outputs.plan.output).toBe("The plan is ready");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/core && vp test tests/store/queries.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement store queries**

```typescript
// packages/core/src/store/queries.ts
import { randomUUID } from "node:crypto";
import type { Database } from "./database.ts";

interface WorkflowRow {
  id: string;
  name: string;
  source: string;
  yaml_hash: string;
  created_at: number;
  updated_at: number;
}

interface RunRow {
  id: string;
  workflow_id: string;
  status: string;
  arguments: string | null;
  branch: string | null;
  worktree_path: string | null;
  started_at: number;
  finished_at: number | null;
}

interface NodeExecutionRow {
  id: string;
  run_id: string;
  node_id: string;
  status: string;
  attempt: number;
  started_at: number;
  finished_at: number | null;
  duration_ms: number | null;
}

interface OutputRow {
  id: string;
  node_execution_id: string;
  content: string;
  exit_code: number | null;
}

interface EventRow {
  id: string;
  run_id: string;
  node_id: string | null;
  type: string;
  payload: string | null;
  timestamp: number;
}

export class StoreQueries {
  constructor(private db: Database) {}

  upsertWorkflow(name: string, source: string, yamlHash: string): string {
    const now = Date.now();
    const existing = this.db.prepare("SELECT id FROM workflows WHERE name = ?").get(name) as
      | { id: string }
      | undefined;
    if (existing) {
      this.db
        .prepare("UPDATE workflows SET source = ?, yaml_hash = ?, updated_at = ? WHERE id = ?")
        .run(source, yamlHash, now, existing.id);
      return existing.id;
    }
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO workflows (id, name, source, yaml_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(id, name, source, yamlHash, now, now);
    return id;
  }

  getWorkflow(id: string): WorkflowRow | null {
    return (this.db.prepare("SELECT * FROM workflows WHERE id = ?").get(id) as WorkflowRow) ?? null;
  }

  createRun(workflowId: string, args?: string): string {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO runs (id, workflow_id, status, arguments, started_at) VALUES (?, ?, 'pending', ?, ?)",
      )
      .run(id, workflowId, args ?? null, Date.now());
    return id;
  }

  getRun(id: string): RunRow | null {
    return (this.db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunRow) ?? null;
  }

  updateRunStatus(id: string, status: string): void {
    const finishedAt = ["completed", "failed", "cancelled"].includes(status) ? Date.now() : null;
    this.db
      .prepare("UPDATE runs SET status = ?, finished_at = COALESCE(?, finished_at) WHERE id = ?")
      .run(status, finishedAt, id);
  }

  createNodeExecution(runId: string, nodeId: string, attempt: number): string {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO node_executions (id, run_id, node_id, status, attempt, started_at) VALUES (?, ?, ?, 'pending', ?, ?)",
      )
      .run(id, runId, nodeId, attempt, Date.now());
    return id;
  }

  getNodeExecution(id: string): NodeExecutionRow | null {
    return (
      (this.db.prepare("SELECT * FROM node_executions WHERE id = ?").get(id) as NodeExecutionRow) ??
      null
    );
  }

  updateNodeExecutionStatus(id: string, status: string, durationMs?: number): void {
    const finishedAt = ["completed", "failed", "skipped"].includes(status) ? Date.now() : null;
    this.db
      .prepare(
        "UPDATE node_executions SET status = ?, finished_at = COALESCE(?, finished_at), duration_ms = COALESCE(?, duration_ms) WHERE id = ?",
      )
      .run(status, finishedAt, durationMs ?? null, id);
  }

  saveOutput(nodeExecutionId: string, content: string, exitCode?: number | null): string {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO outputs (id, node_execution_id, content, exit_code) VALUES (?, ?, ?, ?)",
      )
      .run(id, nodeExecutionId, content, exitCode ?? null);
    return id;
  }

  getOutput(nodeExecutionId: string): OutputRow | null {
    return (
      (this.db
        .prepare("SELECT * FROM outputs WHERE node_execution_id = ?")
        .get(nodeExecutionId) as OutputRow) ?? null
    );
  }

  recordEvent(runId: string, nodeId: string | null, type: string, payload?: string): string {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO events (id, run_id, node_id, type, payload, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(id, runId, nodeId, type, payload ?? null, Date.now());
    return id;
  }

  getEvents(runId: string): EventRow[] {
    return this.db
      .prepare("SELECT * FROM events WHERE run_id = ? ORDER BY timestamp ASC")
      .all(runId) as EventRow[];
  }

  getNodeOutputs(runId: string): Record<string, { output: string }> {
    const rows = this.db
      .prepare(
        `
      SELECT ne.node_id, o.content
      FROM node_executions ne
      JOIN outputs o ON o.node_execution_id = ne.id
      WHERE ne.run_id = ? AND ne.status = 'completed'
      ORDER BY ne.finished_at DESC
    `,
      )
      .all(runId) as { node_id: string; content: string }[];

    const result: Record<string, { output: string }> = {};
    for (const row of rows) {
      if (!result[row.node_id]) {
        result[row.node_id] = { output: row.content };
      }
    }
    return result;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && vp test tests/store/queries.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/store/queries.ts packages/core/tests/store/queries.test.ts
git commit -m "feat(core): add StoreQueries CRUD for runs, nodes, outputs, events"
```

---

### Task 11: Shell runner

**Files:**

- Create: `packages/core/src/runners/shell-runner.ts`
- Create: `packages/core/tests/runners/shell-runner.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/tests/runners/shell-runner.test.ts
import { describe, expect, it } from "vite-plus/test";
import { runShell } from "../../src/runners/shell-runner.ts";

describe("runShell", () => {
  it("captures stdout", async () => {
    const result = await runShell("echo hello", "/tmp");
    expect(result.output.trim()).toBe("hello");
    expect(result.exitCode).toBe(0);
  });

  it("captures stderr on failure", async () => {
    const result = await runShell("echo error >&2 && exit 1", "/tmp");
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("error");
  });

  it("runs in specified working directory", async () => {
    const result = await runShell("pwd", "/tmp");
    expect(result.output.trim()).toBe("/tmp");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/core && vp test tests/runners/shell-runner.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement shell runner**

```typescript
// packages/core/src/runners/shell-runner.ts
import { exec } from "node:child_process";

export interface ShellResult {
  output: string;
  exitCode: number;
}

export function runShell(command: string, cwd: string): Promise<ShellResult> {
  return new Promise((resolve) => {
    exec(command, { cwd, shell: "/bin/bash" }, (error, stdout, stderr) => {
      const output = stdout + stderr;
      const exitCode = error?.code ?? 0;
      resolve({ output, exitCode: typeof exitCode === "number" ? exitCode : 1 });
    });
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && vp test tests/runners/shell-runner.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/runners/shell-runner.ts packages/core/tests/runners/shell-runner.test.ts
git commit -m "feat(core): add shell runner (bash execution with stdout/stderr capture)"
```

---

### Task 12: AI runner, approval runner, cancel runner

**Files:**

- Create: `packages/core/src/runners/ai-runner.ts`
- Create: `packages/core/src/runners/approval-runner.ts`
- Create: `packages/core/src/runners/cancel-runner.ts`

- [ ] **Step 1: Implement AI runner**

The AI runner wraps the Claude Agent SDK. It cannot be unit-tested without a real API key, so it is designed for integration testing later.

```typescript
// packages/core/src/runners/ai-runner.ts
import type { Node } from "../schema/node.ts";
import type { Workflow } from "../schema/workflow.ts";

export interface AiResult {
  output: string;
  sessionId?: string;
}

export async function runAi(
  prompt: string,
  node: Node,
  workflow: Workflow,
  cwd: string,
  resumeSessionId?: string,
): Promise<AiResult> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  let output = "";
  let sessionId: string | undefined;

  for await (const message of query({
    prompt,
    options: {
      allowedTools: node.allowed_tools,
      deniedTools: node.denied_tools,
      model: node.model ?? workflow.model,
      systemPrompt: node.systemPrompt,
      cwd,
      resume: resumeSessionId,
    },
  })) {
    if ("type" in message && message.type === "system" && (message as any).subtype === "init") {
      sessionId = (message as any).session_id;
    }
    if ("result" in message) {
      output = (message as any).result;
    }
  }

  return { output, sessionId };
}
```

- [ ] **Step 2: Implement approval runner**

```typescript
// packages/core/src/runners/approval-runner.ts
import type { ApprovalConfig } from "../schema/node.ts";
import type { WorkflowEventBus } from "../events/event-bus.ts";

export interface ApprovalResult {
  approved: boolean;
  response?: string;
}

export function requestApproval(
  runId: string,
  nodeId: string,
  config: ApprovalConfig,
  eventBus: WorkflowEventBus,
): Promise<ApprovalResult> {
  eventBus.emit("approval:request", { runId, nodeId, message: config.message });

  // Returns a promise that the executor resolves when the MCP server
  // receives an approve/reject action from the user.
  return new Promise((resolve) => {
    const handler = (result: ApprovalResult) => resolve(result);
    // Store the resolver so the executor can call it from outside
    (requestApproval as any)._pendingResolvers ??= new Map();
    (requestApproval as any)._pendingResolvers.set(`${runId}:${nodeId}`, handler);
  });
}

export function resolveApproval(runId: string, nodeId: string, result: ApprovalResult): void {
  const resolvers = (requestApproval as any)._pendingResolvers as
    | Map<string, (r: ApprovalResult) => void>
    | undefined;
  const key = `${runId}:${nodeId}`;
  const resolver = resolvers?.get(key);
  if (resolver) {
    resolver(result);
    resolvers!.delete(key);
  }
}
```

- [ ] **Step 3: Implement cancel runner**

```typescript
// packages/core/src/runners/cancel-runner.ts
export class WorkflowCancelledError extends Error {
  constructor(public readonly reason: string) {
    super(`Workflow cancelled: ${reason}`);
    this.name = "WorkflowCancelledError";
  }
}

export function runCancel(reason: string): never {
  throw new WorkflowCancelledError(reason);
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/runners/ai-runner.ts packages/core/src/runners/approval-runner.ts packages/core/src/runners/cancel-runner.ts
git commit -m "feat(core): add AI, approval, and cancel runners"
```

---

### Task 13: Loop runner

**Files:**

- Create: `packages/core/src/runners/loop-runner.ts`
- Create: `packages/core/tests/runners/loop-runner.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/tests/runners/loop-runner.test.ts
import { describe, expect, it, vi } from "vite-plus/test";
import { runLoop } from "../../src/runners/loop-runner.ts";
import type { Node } from "../../src/schema/node.ts";
import type { Workflow } from "../../src/schema/workflow.ts";

describe("runLoop", () => {
  it("iterates until the signal is found in output", async () => {
    let callCount = 0;
    const mockRunAi = vi.fn(async () => {
      callCount++;
      return {
        output: callCount >= 3 ? "<promise>COMPLETE</promise>" : "still working",
        sessionId: "sess-1",
      };
    });

    const node = {
      id: "impl",
      loop: {
        prompt: "Do the next step",
        until: "COMPLETE",
        max_iterations: 10,
        fresh_context: false,
      },
    } as unknown as Node;
    const workflow = { name: "test" } as Workflow;

    const result = await runLoop(node, workflow, "/tmp", mockRunAi);
    expect(mockRunAi).toHaveBeenCalledTimes(3);
    expect(result.output).toContain("COMPLETE");
  });

  it("stops at max_iterations", async () => {
    const mockRunAi = vi.fn(async () => ({ output: "not done", sessionId: "s" }));

    const node = {
      id: "impl",
      loop: { prompt: "Do it", until: "DONE", max_iterations: 2, fresh_context: true },
    } as unknown as Node;
    const workflow = { name: "test" } as Workflow;

    const result = await runLoop(node, workflow, "/tmp", mockRunAi);
    expect(mockRunAi).toHaveBeenCalledTimes(2);
    expect(result.output).toBe("not done");
    expect(result.maxIterationsReached).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/core && vp test tests/runners/loop-runner.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement loop runner**

```typescript
// packages/core/src/runners/loop-runner.ts
import type { Node } from "../schema/node.ts";
import type { Workflow } from "../schema/workflow.ts";
import type { AiResult } from "./ai-runner.ts";

export interface LoopResult {
  output: string;
  iterations: number;
  maxIterationsReached: boolean;
}

type AiRunnerFn = (
  prompt: string,
  node: Node,
  workflow: Workflow,
  cwd: string,
  resumeSessionId?: string,
) => Promise<AiResult>;

export async function runLoop(
  node: Node,
  workflow: Workflow,
  cwd: string,
  runAiFn: AiRunnerFn,
): Promise<LoopResult> {
  const loop = node.loop!;
  let sessionId: string | undefined;
  let lastOutput = "";

  for (let i = 0; i < loop.max_iterations; i++) {
    const resume = loop.fresh_context ? undefined : sessionId;
    const result = await runAiFn(loop.prompt, node, workflow, cwd, resume);
    lastOutput = result.output;
    sessionId = result.sessionId ?? sessionId;

    if (lastOutput.includes(loop.until)) {
      return { output: lastOutput, iterations: i + 1, maxIterationsReached: false };
    }
  }

  return { output: lastOutput, iterations: loop.max_iterations, maxIterationsReached: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && vp test tests/runners/loop-runner.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/runners/loop-runner.ts packages/core/tests/runners/loop-runner.test.ts
git commit -m "feat(core): add loop runner with iteration limit and signal detection"
```

---

### Task 14: Executor — layer-by-layer DAG execution

**Files:**

- Create: `packages/core/src/executor/executor.ts`
- Create: `packages/core/tests/executor/executor.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/tests/executor/executor.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vite-plus/test";
import { WorkflowExecutor } from "../../src/executor/executor.ts";
import { createDatabase, type Database } from "../../src/store/database.ts";
import { StoreQueries } from "../../src/store/queries.ts";
import { WorkflowEventBus } from "../../src/events/event-bus.ts";
import type { Workflow } from "../../src/schema/workflow.ts";

describe("WorkflowExecutor", () => {
  let db: Database;
  let store: StoreQueries;
  let eventBus: WorkflowEventBus;

  beforeEach(() => {
    db = createDatabase(":memory:");
    store = new StoreQueries(db);
    eventBus = new WorkflowEventBus();
  });

  afterEach(() => {
    db.close();
  });

  it("executes a simple sequential workflow with bash nodes", async () => {
    const workflow: Workflow = {
      name: "test-sequential",
      interactive: false,
      nodes: [
        {
          id: "step1",
          bash: "echo hello",
          depends_on: [],
          trigger_rule: "all_success",
          context: "fresh",
        },
        {
          id: "step2",
          bash: "echo world",
          depends_on: ["step1"],
          trigger_rule: "all_success",
          context: "fresh",
        },
      ],
    } as Workflow;

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp");

    expect(result.status).toBe("completed");
    const outputs = store.getNodeOutputs(result.runId);
    expect(outputs.step1.output.trim()).toBe("hello");
    expect(outputs.step2.output.trim()).toBe("world");
  });

  it("executes parallel nodes concurrently", async () => {
    const workflow: Workflow = {
      name: "test-parallel",
      interactive: false,
      nodes: [
        {
          id: "root",
          bash: "echo root",
          depends_on: [],
          trigger_rule: "all_success",
          context: "fresh",
        },
        {
          id: "a",
          bash: "echo a",
          depends_on: ["root"],
          trigger_rule: "all_success",
          context: "fresh",
        },
        {
          id: "b",
          bash: "echo b",
          depends_on: ["root"],
          trigger_rule: "all_success",
          context: "fresh",
        },
        {
          id: "join",
          bash: "echo done",
          depends_on: ["a", "b"],
          trigger_rule: "all_success",
          context: "fresh",
        },
      ],
    } as Workflow;

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp");

    expect(result.status).toBe("completed");
    const outputs = store.getNodeOutputs(result.runId);
    expect(outputs.root).toBeDefined();
    expect(outputs.a).toBeDefined();
    expect(outputs.b).toBeDefined();
    expect(outputs.join).toBeDefined();
  });

  it("skips nodes when 'when' condition is false", async () => {
    const workflow: Workflow = {
      name: "test-conditional",
      interactive: false,
      nodes: [
        {
          id: "check",
          bash: 'echo \'{"type":"simple"}\'',
          depends_on: [],
          trigger_rule: "all_success",
          context: "fresh",
        },
        {
          id: "simple",
          bash: "echo simple-path",
          depends_on: ["check"],
          when: "$check.output.type == 'simple'",
          trigger_rule: "all_success",
          context: "fresh",
        },
        {
          id: "complex",
          bash: "echo complex-path",
          depends_on: ["check"],
          when: "$check.output.type == 'complex'",
          trigger_rule: "all_success",
          context: "fresh",
        },
      ],
    } as Workflow;

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp");

    expect(result.status).toBe("completed");
    const outputs = store.getNodeOutputs(result.runId);
    expect(outputs.simple).toBeDefined();
    expect(outputs.complex).toBeUndefined();
  });

  it("emits events during execution", async () => {
    const events: string[] = [];
    eventBus.on("node:start", (e) => events.push(`start:${e.nodeId}`));
    eventBus.on("node:complete", (e) => events.push(`complete:${e.nodeId}`));
    eventBus.on("run:done", (e) => events.push(`done:${e.status}`));

    const workflow: Workflow = {
      name: "test-events",
      interactive: false,
      nodes: [
        {
          id: "only",
          bash: "echo ok",
          depends_on: [],
          trigger_rule: "all_success",
          context: "fresh",
        },
      ],
    } as Workflow;

    const executor = new WorkflowExecutor(store, eventBus);
    await executor.run(workflow, "/tmp");

    expect(events).toContain("start:only");
    expect(events).toContain("complete:only");
    expect(events).toContain("done:completed");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/core && vp test tests/executor/executor.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement the executor**

```typescript
// packages/core/src/executor/executor.ts
import { createHash } from "node:crypto";
import { buildDag } from "../dag/build-dag.ts";
import { substituteVariables } from "../variables/substitute.ts";
import { runShell } from "../runners/shell-runner.ts";
import { runAi } from "../runners/ai-runner.ts";
import { runLoop } from "../runners/loop-runner.ts";
import { requestApproval } from "../runners/approval-runner.ts";
import { runCancel, WorkflowCancelledError } from "../runners/cancel-runner.ts";
import type { StoreQueries } from "../store/queries.ts";
import type { WorkflowEventBus } from "../events/event-bus.ts";
import type { Workflow } from "../schema/workflow.ts";
import type { Node } from "../schema/node.ts";

export interface RunResult {
  runId: string;
  status: "completed" | "failed" | "cancelled" | "paused";
}

function evaluateWhen(condition: string, nodeOutputs: Record<string, { output: string }>): boolean {
  // Evaluate simple conditions: $nodeId.output.field == 'VALUE'
  const simpleMatch = condition.match(/^\$(\w+)\.output\.(\w+)\s*(==|!=|>|>=|<|<=)\s*'([^']*)'$/);
  if (simpleMatch) {
    const [, nodeId, field, op, value] = simpleMatch;
    const node = nodeOutputs[nodeId];
    if (!node) return false;
    try {
      const parsed = JSON.parse(node.output);
      const actual = String(parsed[field] ?? "");
      switch (op) {
        case "==":
          return actual === value;
        case "!=":
          return actual !== value;
        case ">":
          return Number(actual) > Number(value);
        case ">=":
          return Number(actual) >= Number(value);
        case "<":
          return Number(actual) < Number(value);
        case "<=":
          return Number(actual) <= Number(value);
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  // Evaluate $nodeId.output == 'VALUE' (non-JSON)
  const outputMatch = condition.match(/^\$(\w+)\.output\s*(==|!=)\s*'([^']*)'$/);
  if (outputMatch) {
    const [, nodeId, op, value] = outputMatch;
    const node = nodeOutputs[nodeId];
    if (!node) return false;
    const actual = node.output.trim();
    return op === "==" ? actual === value : actual !== value;
  }

  // Compound conditions with && and ||
  if (condition.includes("&&") || condition.includes("||")) {
    // Split by || first (lower precedence), then by &&
    const orParts = condition.split("||").map((s) => s.trim());
    return orParts.some((orPart) => {
      const andParts = orPart.split("&&").map((s) => s.trim());
      return andParts.every((andPart) => evaluateWhen(andPart, nodeOutputs));
    });
  }

  return false;
}

export class WorkflowExecutor {
  constructor(
    private store: StoreQueries,
    private eventBus: WorkflowEventBus,
  ) {}

  async run(workflow: Workflow, cwd: string, args?: string): Promise<RunResult> {
    const yamlHash = createHash("sha256").update(workflow.name).digest("hex");
    const workflowId = this.store.upsertWorkflow(workflow.name, "custom", yamlHash);
    const runId = this.store.createRun(workflowId, args);
    this.store.updateRunStatus(runId, "running");

    const startTime = Date.now();
    const layers = buildDag(workflow.nodes);
    const nodeMap = new Map(workflow.nodes.map((n) => [n.id, n]));

    try {
      for (const layer of layers) {
        const nodeOutputs = this.store.getNodeOutputs(runId);
        const completedCount = Object.keys(nodeOutputs).length;

        this.eventBus.emit("run:progress", {
          runId,
          completedNodes: completedCount,
          totalNodes: workflow.nodes.length,
        });

        const executions = layer.nodeIds.map(async (nodeId) => {
          const node = nodeMap.get(nodeId)!;

          // Evaluate when condition
          if (node.when) {
            const shouldRun = evaluateWhen(node.when, nodeOutputs);
            if (!shouldRun) {
              this.eventBus.emit("node:skipped", {
                runId,
                nodeId,
                reason: `when condition false: ${node.when}`,
              });
              return;
            }
          }

          const execId = this.store.createNodeExecution(runId, nodeId, 1);
          this.store.updateNodeExecutionStatus(execId, "running");
          this.eventBus.emit("node:start", { runId, nodeId, attempt: 1 });

          const nodeStart = Date.now();

          try {
            const builtins: Record<string, string> = {
              ARGUMENTS: args ?? "",
              WORKFLOW_ID: runId,
              BASE_BRANCH: "main",
              ARTIFACTS_DIR: `${cwd}/.cc-framework/artifacts/${runId}`,
              DOCS_DIR: `${cwd}/docs`,
            };

            let output: string;

            if (node.bash !== undefined) {
              const substituted = substituteVariables(node.bash, builtins, nodeOutputs);
              const result = await runShell(substituted, cwd);
              output = result.output;
              this.store.saveOutput(execId, output, result.exitCode);
              if (result.exitCode !== 0) {
                throw new Error(`Shell command failed with exit code ${result.exitCode}`);
              }
            } else if (node.prompt !== undefined) {
              const substituted = substituteVariables(node.prompt, builtins, nodeOutputs);
              const result = await runAi(substituted, node, workflow, cwd);
              output = result.output;
              this.store.saveOutput(execId, output);
            } else if (node.loop !== undefined) {
              const result = await runLoop(node, workflow, cwd, runAi);
              output = result.output;
              this.store.saveOutput(execId, output);
            } else if (node.approval !== undefined) {
              const result = await requestApproval(runId, nodeId, node.approval, this.eventBus);
              output = result.approved ? "approved" : `rejected: ${result.response ?? ""}`;
              this.store.saveOutput(execId, output);
              if (!result.approved) {
                throw new Error(`Approval rejected: ${result.response ?? "no reason"}`);
              }
            } else if (node.cancel !== undefined) {
              runCancel(node.cancel);
            } else {
              throw new Error(`Unknown node type for node "${nodeId}"`);
            }

            const durationMs = Date.now() - nodeStart;
            this.store.updateNodeExecutionStatus(execId, "completed", durationMs);
            this.eventBus.emit("node:complete", { runId, nodeId, output, durationMs });
          } catch (error) {
            if (error instanceof WorkflowCancelledError) throw error;
            const durationMs = Date.now() - nodeStart;
            this.store.updateNodeExecutionStatus(execId, "failed", durationMs);
            const message = error instanceof Error ? error.message : String(error);
            this.eventBus.emit("node:error", { runId, nodeId, error: message, attempt: 1 });
            throw error;
          }
        });

        await Promise.all(executions);
      }

      this.store.updateRunStatus(runId, "completed");
      this.eventBus.emit("run:done", {
        runId,
        status: "completed",
        durationMs: Date.now() - startTime,
      });
      return { runId, status: "completed" };
    } catch (error) {
      if (error instanceof WorkflowCancelledError) {
        this.store.updateRunStatus(runId, "cancelled");
        this.eventBus.emit("run:done", {
          runId,
          status: "cancelled",
          durationMs: Date.now() - startTime,
        });
        return { runId, status: "cancelled" };
      }
      this.store.updateRunStatus(runId, "failed");
      this.eventBus.emit("run:done", {
        runId,
        status: "failed",
        durationMs: Date.now() - startTime,
      });
      return { runId, status: "failed" };
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && vp test tests/executor/executor.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/executor/ packages/core/tests/executor/
git commit -m "feat(core): add WorkflowExecutor with layer-by-layer parallel DAG execution"
```

---

### Task 15: Isolation — git worktree and branch management

**Files:**

- Create: `packages/core/src/isolation/isolation.ts`

- [ ] **Step 1: Implement isolation manager**

```typescript
// packages/core/src/isolation/isolation.ts
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Isolation } from "../schema/common.ts";

const execAsync = promisify(exec);

export interface IsolationEnvironment {
  strategy: "worktree" | "branch";
  branchName: string;
  worktreePath?: string;
  originalCwd: string;
  workingDirectory: string;
}

export async function setupIsolation(
  config: Isolation,
  runId: string,
  cwd: string,
): Promise<IsolationEnvironment> {
  const branchName = `${config.branch_prefix}${runId}`;

  if (config.strategy === "worktree") {
    const worktreePath = `${cwd}/../.cc-framework-worktrees/${runId}`;
    await execAsync(`git worktree add -b "${branchName}" "${worktreePath}"`, { cwd });
    return {
      strategy: "worktree",
      branchName,
      worktreePath,
      originalCwd: cwd,
      workingDirectory: worktreePath,
    };
  }

  // Branch strategy — create branch, stay in same directory
  await execAsync(`git checkout -b "${branchName}"`, { cwd });
  return {
    strategy: "branch",
    branchName,
    originalCwd: cwd,
    workingDirectory: cwd,
  };
}

export async function cleanupIsolation(env: IsolationEnvironment): Promise<void> {
  if (env.strategy === "worktree") {
    await execAsync(`git worktree remove "${env.worktreePath}" --force`, {
      cwd: env.originalCwd,
    }).catch(() => {});
    await execAsync(`git branch -D "${env.branchName}"`, { cwd: env.originalCwd }).catch(() => {});
  }
  // Branch strategy: don't auto-cleanup — the user may want to keep the branch
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/isolation/
git commit -m "feat(core): add git isolation (worktree and branch strategies)"
```

---

### Task 16: Public API barrel export

**Files:**

- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Wire up the public API**

```typescript
// packages/core/src/index.ts

// Schema
export { WorkflowSchema, type Workflow } from "./schema/workflow.ts";
export { NodeSchema, type Node, type LoopConfig, type ApprovalConfig } from "./schema/node.ts";
export {
  TriggerRuleSchema,
  IsolationSchema,
  RetrySchema,
  OutputFormatSchema,
  type TriggerRule,
  type Isolation,
  type Retry,
  type OutputFormat,
} from "./schema/common.ts";
export { generateWorkflowJsonSchema } from "./schema/generate-json-schema.ts";

// Parser
export { parseWorkflow } from "./parser/parse-workflow.ts";
export { resolvePrompt } from "./parser/resolve-prompt.ts";

// DAG
export { buildDag, type DagLayer } from "./dag/build-dag.ts";

// Variables
export { substituteVariables } from "./variables/substitute.ts";

// Store
export { createDatabase, type Database } from "./store/database.ts";
export { StoreQueries } from "./store/queries.ts";

// Runners
export { runShell, type ShellResult } from "./runners/shell-runner.ts";
export { runAi, type AiResult } from "./runners/ai-runner.ts";
export { runLoop, type LoopResult } from "./runners/loop-runner.ts";
export {
  requestApproval,
  resolveApproval,
  type ApprovalResult,
} from "./runners/approval-runner.ts";
export { runCancel, WorkflowCancelledError } from "./runners/cancel-runner.ts";

// Executor
export { WorkflowExecutor, type RunResult } from "./executor/executor.ts";

// Events
export {
  WorkflowEventBus,
  type NodeStartEvent,
  type NodeCompleteEvent,
  type NodeErrorEvent,
  type NodeSkippedEvent,
  type RunProgressEvent,
  type RunDoneEvent,
  type ApprovalRequestEvent,
} from "./events/event-bus.ts";

// Isolation
export {
  setupIsolation,
  cleanupIsolation,
  type IsolationEnvironment,
} from "./isolation/isolation.ts";
```

- [ ] **Step 2: Run all tests**

```bash
cd packages/core && vp test
```

Expected: ALL PASS

- [ ] **Step 3: Run type checking**

```bash
vp check
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): wire up public API barrel export"
```

---

### Task 17: Integration test — end-to-end workflow from YAML

**Files:**

- Create: `packages/core/tests/integration.test.ts`

- [ ] **Step 1: Write the integration test**

```typescript
// packages/core/tests/integration.test.ts
import { describe, expect, it, afterEach } from "vite-plus/test";
import { parseWorkflow } from "../src/parser/parse-workflow.ts";
import { createDatabase } from "../src/store/database.ts";
import { StoreQueries } from "../src/store/queries.ts";
import { WorkflowEventBus } from "../src/events/event-bus.ts";
import { WorkflowExecutor } from "../src/executor/executor.ts";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Database } from "../src/store/database.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

describe("Integration: YAML → Parse → Execute", () => {
  let db: Database;

  afterEach(() => {
    db?.close();
  });

  it("parses and executes a minimal workflow end-to-end", async () => {
    const workflow = await parseWorkflow(join(fixturesDir, "minimal.yaml"), fixturesDir);

    db = createDatabase(":memory:");
    const store = new StoreQueries(db);
    const eventBus = new WorkflowEventBus();

    const events: string[] = [];
    eventBus.on("node:start", (e) => events.push(`start:${e.nodeId}`));
    eventBus.on("node:complete", (e) => events.push(`complete:${e.nodeId}`));
    eventBus.on("run:done", (e) => events.push(`done:${e.status}`));

    // Note: This test uses a bash node to avoid requiring an API key.
    // Override the prompt node with a bash node for testing.
    workflow.nodes[0] = {
      ...workflow.nodes[0],
      prompt: undefined,
      bash: "echo 'Hello from integration test'",
    } as any;

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp");

    expect(result.status).toBe("completed");
    expect(events).toContain("start:greet");
    expect(events).toContain("complete:greet");
    expect(events).toContain("done:completed");
  });

  it("parses and executes a parallel workflow", async () => {
    const workflow = await parseWorkflow(join(fixturesDir, "parallel.yaml"), fixturesDir);

    db = createDatabase(":memory:");
    const store = new StoreQueries(db);
    const eventBus = new WorkflowEventBus();

    // Replace AI nodes with bash for testing
    for (const node of workflow.nodes) {
      (node as any).prompt = undefined;
      (node as any).bash = `echo '${node.id} done'`;
    }

    const executor = new WorkflowExecutor(store, eventBus);
    const result = await executor.run(workflow, "/tmp");

    expect(result.status).toBe("completed");
    const outputs = store.getNodeOutputs(result.runId);
    expect(outputs.scope).toBeDefined();
    expect(outputs["review-a"]).toBeDefined();
    expect(outputs["review-b"]).toBeDefined();
    expect(outputs.synthesize).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the integration test**

```bash
cd packages/core && vp test tests/integration.test.ts
```

Expected: PASS

- [ ] **Step 3: Run the full test suite**

```bash
cd packages/core && vp test
```

Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/tests/integration.test.ts
git commit -m "test(core): add end-to-end integration tests (YAML → parse → execute)"
```
