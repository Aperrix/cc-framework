# cc-framework — Design Specification

## Overview

cc-framework is a deterministic workflow engine for AI-assisted software development. It orchestrates AI agents through YAML-defined DAGs (Directed Acyclic Graphs), providing structure, repeatability, and auditability to AI coding workflows.

**Core principle:** Workflows are 100% manually authored in YAML. The AI fills intelligence within deterministic steps — it does not control the structure.

**Runtime:** The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) is the AI runtime. Each AI node spawns an autonomous agent via the SDK, with full access to file editing, shell commands, and codebase analysis. No multi-provider support — the framework is built exclusively on Claude.

**ToS compliance:** cc-framework does not proxy or manage authentication. Users must provide their own Anthropic API key or be authenticated via Claude Code (`claude login`). The SDK handles authentication directly — cc-framework passes prompts and configuration, never credentials.

## Architecture

### Monorepo with Standalone Distribution

The project is a monorepo with modular packages, compiled into a single standalone binary via `bun build --compile`. Users get one file with zero runtime dependencies.

### Packages

| Package              | Type        | Description                                                                  |
| -------------------- | ----------- | ---------------------------------------------------------------------------- |
| `packages/core`      | Library     | Workflow parser, DAG executor, node runners, SQLite store, event bus. No UI. |
| `packages/mcp`       | Application | MCP server — primary interface. Exposes workflows as tools for Claude Code.  |
| `packages/workflows` | Data        | Default YAML workflows and markdown prompt files shipped with the framework. |
| `apps/web`           | Application | React dashboard. DAG visualization, real-time logs, approval UI.             |

### Dependency Flow

```
MCP Server, Web UI
        ↓
      Core
        ↓
Claude Agent SDK · Shell · Git
```

**MCP-first architecture:** The MCP server is the primary interface — users interact with cc-framework through Claude Code via MCP tools. No standalone CLI in v1. If a CLI is needed later (e.g., for CI/CD pipelines), it will be a thin wrapper around core.

Both surfaces (MCP, Web) consume core's programmatic API. Core has no knowledge of its consumers.

## Core Internals (`packages/core`)

### Modules

| Module         | Responsibility                                                                                                                                                                                                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `constants.ts` | Centralized `as const` arrays and derived types for all enum-like values. Single source of truth imported by all other modules.                                                                                                                                                                             |
| `config/`      | Hierarchical configuration loader: built-in defaults → global YAML (`~/.cc-framework/config.yaml`) → project YAML (`.cc-framework/config.yaml`) → environment variables.                                                                                                                                    |
| `schema/`      | Zod v4 schemas defining the workflow YAML format. Source of truth for validation, TypeScript types, and JSON Schema generation (via native `z.toJSONSchema()`).                                                                                                                                             |
| `parser/`      | Loads and validates YAML workflow files via Zod schemas. Resolves `prompt:` file references from `.cc-framework/prompts/` or project root.                                                                                                                                                                  |
| `discovery/`   | Multi-stage discovery for workflows, prompts, and scripts across embedded defaults → global → project directories, with override by name.                                                                                                                                                                   |
| `dag/`         | Builds the dependency graph via Kahn's algorithm. Topological sort, cycle detection, parallel layer computation.                                                                                                                                                                                            |
| `executor/`    | Traverses the DAG layer by layer. Evaluates `when:` conditions, dispatches to runners, handles retry with exponential backoff, checkpoint/resume, session threading, inter-node output validation, and status checks between layers.                                                                        |
| `runners/`     | One runner per execution type: `ai` (Claude Agent SDK `query()`), `code-mode` (LLM generates script, framework executes it), `script` (bash/bun/uv via `execFile()`), `loop` (iterates AI runner), `approval` (DB-backed pause/resume), `cancel` (stops workflow), `error-classifier` (fatal vs transient). |
| `store/`       | Drizzle ORM over SQLite (better-sqlite3). 7 tables with typed queries. Includes workflow metrics (`getWorkflowStats()`).                                                                                                                                                                                    |
| `isolation/`   | Git worktree and branch management. Setup, cleanup, orphan detection, and stale worktree pruning.                                                                                                                                                                                                           |
| `variables/`   | Resolves substitutions in prompt strings: `$nodeId.output`, `$nodeId.output.field`, `$ARGUMENTS`, `$ARTIFACTS_DIR`, JSON dot notation.                                                                                                                                                                      |
| `events/`      | Typed EventEmitter bus for consumers. Emits: `node:start`, `node:complete`, `node:error`, `node:skipped`, `run:progress`, `run:done`, `approval:request`.                                                                                                                                                   |

### Execution Flow

1. **Load config** — Hierarchical merge: defaults → global YAML → project YAML → env vars
2. **Parse** — YAML file loaded, validated via Zod v4, `prompt:` file references resolved
3. **Build DAG** — Nodes assembled into topological layers via Kahn's algorithm
4. **Setup isolation** — Worktree or branch created based on workflow config (if configured)
5. **Pre-create artifacts** — `$ARTIFACTS_DIR` created on disk for node file outputs
6. **Execute layers** — For each layer:
   a. Skip completed nodes (checkpoint/resume)
   b. Evaluate `when:` conditions, skip non-matching nodes
   c. Run eligible nodes in parallel via `Promise.allSettled()`
   d. Thread session IDs through sequential (single-node) layers
   e. For AI nodes: dispatch to agent mode (`runAi`) or code mode (`runCodeMode`)
   f. For each node: validate structured output against `output_format` schema
   g. On failure: classify error (fatal/transient), retry with exponential backoff if retryable
   h. Persist node output in SQLite for downstream variable substitution
7. **Between layers** — Check run status in DB (supports external cancellation/pause)
8. **Finalize** — Update run status, emit `run:done` event, cleanup isolation if configured

## Workflow YAML Specification

The workflow spec is based on Archon's workflow format, adapted for the Claude Agent SDK runtime.

### AI Runtime — Claude Agent SDK

The AI runner uses `@anthropic-ai/claude-agent-sdk` to execute AI nodes. The SDK exposes a `query()` function that runs an autonomous agent with built-in tools (Read, Write, Edit, Bash, Glob, Grep, WebSearch, etc.):

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// Each AI node calls query() with the resolved prompt
for await (const message of query({
  prompt: resolvedPrompt,
  options: {
    allowedTools: nodeConfig.allowed_tools ?? ["Read", "Edit", "Bash", "Glob", "Grep"],
    systemPrompt: nodeConfig.systemPrompt,
    cwd: workingDirectory,
  },
})) {
  if ("result" in message) {
    // Capture the node output for $nodeId.output
    nodeOutput = message.result;
  }
}
```

**Key behaviors:**

- `context: fresh` — each AI node runs an independent `query()` call with no prior context
- `context: shared` — nodes in a chain reuse the same session via the `resume: sessionId` option, preserving conversation history across nodes
- Tool restrictions (`allowed_tools`, `denied_tools`) map directly to the SDK's `allowedTools` option
- `output_format` enables structured JSON outputs for conditional routing (`when:` conditions)
- Subagents — the SDK supports spawning subagents via the `Agent` tool and the `agents` option for defining specialized agent roles
- Hooks — the SDK's `hooks` option (PreToolUse, PostToolUse, Stop, etc.) is exposed via the workflow YAML `hooks:` field
- MCP servers — the SDK's `mcpServers` option is exposed via the workflow YAML `mcp:` field
- The SDK handles file access, shell execution, web search, and codebase analysis natively — the framework doesn't reimplement these

### Top-Level Properties

```yaml
name: workflow-name
description: What this workflow does
provider: claude # AI provider (currently only Claude supported)
model: sonnet # Claude model override
modelReasoningEffort: high # Codex-style reasoning effort
webSearchMode: disabled # disabled / cached / live
additionalDirectories: [] # Extra directories for context
interactive: false # Web UI: run in foreground if true
effort: high # Reasoning depth
thinking: adaptive # Extended thinking mode
fallbackModel: claude-haiku-4-5-20251001
betas: ["context-1m-2025-08-07"]
sandbox:
  enabled: true
  autoAllowBashIfSandboxed: false
  ignoreViolations: false
  network:
    allowedDomains: []
    allowManagedDomainsOnly: true

isolation:
  strategy: worktree # "worktree" or "branch"
  branch_prefix: ccf/

inputs:
  issue:
    type: string
    required: true
    description: GitHub issue number

nodes:
  - id: node-id
    # ... node configuration
```

### Node Types

Each node accepts exactly one of these types (mutually exclusive):

| Type       | Syntax                                               | Description                                                                                                                                                                                                                                                                  |
| ---------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`   | `prompt: "instruction"` or `prompt: path/to/file.md` | AI node — inline string or path to a markdown file. If the value ends with `.md` or starts with `./` / `/`, it is loaded as a file; otherwise treated as inline text. File paths are resolved relative to `.cc-framework/prompts/` first, then relative to the project root. |
| `script`   | `script: "command"` or `script: path/to/file.sh`     | Deterministic script execution (no AI). Supports bash (default), bun, uv runtimes via `runtime:` field. File paths detected by extension (.sh/.ts/.py) or prefix (./).                                                                                                       |
| `loop`     | `loop: { prompt, until, ... }`                       | Iterates until signal (the inner `prompt` follows the same string-or-path rules)                                                                                                                                                                                             |
| `approval` | `approval: { message }`                              | Pauses for human review                                                                                                                                                                                                                                                      |
| `cancel`   | `cancel: "reason"`                                   | Stops the workflow                                                                                                                                                                                                                                                           |

### Prompt Execution Modes

Prompt nodes support two execution strategies via the `execution:` field:

| Mode              | Description                                                                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent` (default) | Full agent loop via Claude Agent SDK — the model uses tool calls (Read, Edit, Bash, etc.) to accomplish the task. Best for complex reasoning and multi-step exploration.               |
| `code`            | Code Mode — the model generates a complete executable script instead of making tool calls. The script is executed in a sandbox via the script runner. Best for batch/repetitive tasks. |

Code Mode is inspired by Cloudflare Code Mode and Anthropic PTC. Key benefits:

- **Reliability**: 30 tool calls at 98% = 54% end-to-end. 1 code gen + 1 execution = 96%.
- **Token efficiency**: 32-81% fewer tokens on complex tasks (Cloudflare benchmarks).
- **Native capabilities**: Generated code can use loops, conditionals, date/time, and data structures — things tool calls can't express.

```yaml
# Agent mode (default) — full tool-calling agent loop
- id: investigate
  prompt: "Investigate the bug in auth.py and fix it"

# Code Mode — generate and execute a script
- id: batch-create
  prompt: "Create a test file for each module in src/"
  execution: code
  runtime: bun
```

### Common Node Properties

```yaml
nodes:
  - id: unique-node-id
    depends_on: [node1, node2] # Dependencies (default: [])
    when: "$node1.output == 'X'" # Conditional execution
    trigger_rule: all_success # Join semantics
    context: fresh # "fresh" or "shared"
    idle_timeout: 120000 # ms before timeout
    retry:
      max_attempts: 2
      delay_ms: 3000
      on_error: transient # "transient" or "all"
```

### Trigger Rules

| Value                         | Behavior                                   |
| ----------------------------- | ------------------------------------------ |
| `all_success` (default)       | Execute if all dependencies succeed        |
| `one_success`                 | Execute if >= 1 dependency succeeds        |
| `none_failed_min_one_success` | Execute if none failed AND >= 1 succeeded  |
| `all_done`                    | Execute when all dependencies are terminal |

### When Conditions

```yaml
# String comparisons
when: "$nodeId.output == 'VALUE'"
when: "$nodeId.output != 'VALUE'"
when: "$nodeId.output.field == 'VALUE'"

# Numeric comparisons
when: "$nodeId.output > '80'"
when: "$nodeId.output >= '0.9'"

# Compound expressions (&& has priority over ||)
when: "$a.output == 'X' && $b.output != 'Y'"
when: "$a.output == 'X' || $b.output == 'Y'"
```

Invalid expressions default to `false` (node skipped).

### AI Node Properties

```yaml
nodes:
  - id: ai-node
    prompt: investigate-issue.md
    execution: agent # "agent" (default) or "code"
    model: opus # Per-node model override
    provider: claude # Per-node provider override
    maxBudgetUsd: 2.50 # Maximum cost for this node
    output_format: # Structured output (validated before passing downstream)
      type: object
      properties:
        field_name:
          type: string
          enum: [VALUE1, VALUE2]
      required: [field_name]
    allowed_tools: [Read, Grep] # Tool whitelist
    denied_tools: [WebSearch] # Tool blacklist
    effort: low|medium|high|max
    thinking: adaptive|disabled
    systemPrompt: "You are..."
    fallbackModel: claude-haiku-4-5-20251001
    betas: ["context-1m-2025-08-07"]
    hooks:
      onToolCall: |
        function(toolName, input) { ... }
    mcp: .cc-framework/mcp/servers.json
    skills: [skill-name]
    sandbox:
      enabled: true
      autoAllowBashIfSandboxed: false
      filesystem:
        denyWrite: ["/etc", "/usr"]
      network:
        allowedDomains: ["api.example.com"]
```

### Loop Nodes

```yaml
nodes:
  - id: iterative-node
    loop:
      prompt: |
        Instruction for each iteration.
        Access: $LOOP_USER_INPUT (user feedback)
        Emit <promise>COMPLETE</promise> to finish.
      until: COMPLETE
      max_iterations: 15
      fresh_context: true
      interactive: true
      gate_message: "Provide feedback or say 'done'"
```

### Approval Nodes

```yaml
nodes:
  - id: review-gate
    approval:
      message: "Review the proposed changes. Approve or request changes."
      capture_response: true
      on_reject:
        prompt: "Fix based on: $REJECTION_REASON"
        max_attempts: 3
```

### Variable Substitution

| Variable                       | Description                       |
| ------------------------------ | --------------------------------- |
| `$ARGUMENTS` / `$USER_MESSAGE` | User input                        |
| `$WORKFLOW_ID`                 | Unique run ID                     |
| `$ARTIFACTS_DIR`               | Pre-created artifacts directory   |
| `$BASE_BRANCH`                 | Base branch                       |
| `$DOCS_DIR`                    | Docs path (default: `docs/`)      |
| `$CONTEXT`                     | GitHub context (issue/PR)         |
| `$nodeId.output`               | Full output of an upstream node   |
| `$nodeId.output.field`         | JSON field from structured output |
| `$LOOP_USER_INPUT`             | User input (interactive loop)     |
| `$REJECTION_REASON`            | Rejection reason (approval)       |

### Parallelism

Nodes are grouped into topological layers. Within a layer, all nodes execute in parallel. A node is placed in the earliest layer where all its `depends_on` dependencies are satisfied.

```yaml
nodes:
  - id: scope
    prompt: create-review-scope.md

  # These 3 nodes share depends_on: [scope] → parallel execution
  - id: code-review
    prompt: code-review-agent.md
    depends_on: [scope]
    context: fresh

  - id: test-review
    prompt: test-coverage-agent.md
    depends_on: [scope]
    context: fresh

  - id: security-review
    prompt: security-review-agent.md
    depends_on: [scope]
    context: fresh

  # Waits for all 3 reviews
  - id: synthesize
    prompt: synthesize-reviews.md
    depends_on: [code-review, test-review, security-review]
    trigger_rule: none_failed_min_one_success
```

## Database Schema (SQLite)

### Tables

**`workflows`**

| Column       | Type        | Description                 |
| ------------ | ----------- | --------------------------- |
| `id`         | TEXT PK     | UUID                        |
| `name`       | TEXT UNIQUE | Workflow name               |
| `source`     | TEXT        | "embedded" or "custom"      |
| `yaml_hash`  | TEXT        | SHA-256 of the YAML content |
| `created_at` | INTEGER     | Unix timestamp              |
| `updated_at` | INTEGER     | Unix timestamp              |

**`runs`**

| Column          | Type    | Description                                                 |
| --------------- | ------- | ----------------------------------------------------------- |
| `id`            | TEXT PK | UUID                                                        |
| `workflow_id`   | TEXT FK | References workflows.id                                     |
| `status`        | TEXT    | pending / running / paused / completed / failed / cancelled |
| `arguments`     | TEXT    | JSON-encoded arguments                                      |
| `branch`        | TEXT    | Git branch name                                             |
| `worktree_path` | TEXT    | Worktree path (nullable)                                    |
| `started_at`    | INTEGER | Unix timestamp                                              |
| `finished_at`   | INTEGER | Unix timestamp (nullable)                                   |

**`node_executions`**

| Column        | Type    | Description                                      |
| ------------- | ------- | ------------------------------------------------ |
| `id`          | TEXT PK | UUID                                             |
| `run_id`      | TEXT FK | References runs.id                               |
| `node_id`     | TEXT    | Node ID from YAML                                |
| `status`      | TEXT    | pending / running / completed / failed / skipped |
| `attempt`     | INTEGER | Retry attempt number (1-based)                   |
| `started_at`  | INTEGER | Unix timestamp                                   |
| `finished_at` | INTEGER | Unix timestamp (nullable)                        |
| `duration_ms` | INTEGER | Execution duration (nullable)                    |

**`outputs`**

| Column              | Type    | Description                     |
| ------------------- | ------- | ------------------------------- |
| `id`                | TEXT PK | UUID                            |
| `node_execution_id` | TEXT FK | References node_executions.id   |
| `content`           | TEXT    | Output text or JSON             |
| `exit_code`         | INTEGER | Shell node exit code (nullable) |

**`events`**

| Column      | Type    | Description                                          |
| ----------- | ------- | ---------------------------------------------------- |
| `id`        | TEXT PK | UUID                                                 |
| `run_id`    | TEXT FK | References runs.id                                   |
| `node_id`   | TEXT    | Node ID (nullable for run-level events)              |
| `type`      | TEXT    | start / complete / error / retry / approval / cancel |
| `payload`   | TEXT    | JSON-encoded event data                              |
| `timestamp` | INTEGER | Unix timestamp                                       |

**`artifacts`**

| Column       | Type    | Description                         |
| ------------ | ------- | ----------------------------------- |
| `id`         | TEXT PK | UUID                                |
| `run_id`     | TEXT FK | References runs.id                  |
| `node_id`    | TEXT    | Node ID that produced the artifact  |
| `path`       | TEXT    | File path relative to artifacts dir |
| `created_at` | INTEGER | Unix timestamp                      |

**`isolation_environments`**

| Column          | Type    | Description                    |
| --------------- | ------- | ------------------------------ |
| `id`            | TEXT PK | UUID                           |
| `run_id`        | TEXT FK | References runs.id             |
| `strategy`      | TEXT    | "worktree" or "branch"         |
| `branch_name`   | TEXT    | Branch name                    |
| `worktree_path` | TEXT    | Worktree path (nullable)       |
| `status`        | TEXT    | active / cleaned_up / orphaned |
| `created_at`    | INTEGER | Unix timestamp                 |
| `cleaned_at`    | INTEGER | Unix timestamp (nullable)      |

## Project Structure On Disk

### User's Project

```
my-project/
├── .cc-framework/
│   ├── config.yaml              # Project configuration
│   ├── workflows/               # Custom workflows
│   │   └── my-workflow.yaml
│   ├── prompts/                 # Reusable markdown prompt files
│   │   └── investigate-issue.md
│   └── scripts/                 # Reusable script files (.sh, .ts, .py)
│       └── setup.sh
└── ...
```

### Global Configuration

```
~/.cc-framework/
├── config.yaml                  # Global config (overridable per project)
├── workflows/                   # Global workflows (available to all projects)
└── cc-framework.db              # SQLite database
```

Default workflows (shipped with the binary) are available without being copied into the project. Users can override them by creating a file with the same name in `.cc-framework/workflows/`.

## IDE Autocompletion (JSON Schema)

Zod v4 schemas in `packages/core/schema/` are the single source of truth for:

- **Runtime validation** — YAML parsed via `yaml` library, validated with Zod v4
- **TypeScript types** — inferred from Zod schemas via `z.infer<>`
- **JSON Schema** — generated via Zod v4's native `z.toJSONSchema()` (no external library needed)

The JSON Schema is distributed with the binary and published at a stable URL. Users activate autocompletion in their workflow YAML files via:

```yaml
# yaml-language-server: $schema=https://cc-framework.dev/schemas/workflow.json
name: my-workflow
# ← IDE now provides autocompletion, validation, and hover docs
```

Alternatively, users can configure their IDE globally (e.g., VS Code `settings.json` with the YAML extension, or JetBrains built-in YAML support) to associate `**/.cc-framework/workflows/*.yaml` with the schema.

`ccf init` generates a `.vscode/settings.yaml` with the schema mapping pre-configured.

## Web UI (`apps/web`)

React dashboard (launch mechanism TBD — via MCP tool or standalone serve command):

- **Run list** — Status, workflow name, duration, filters
- **DAG view** — Interactive graph visualization with nodes colored by status (pending / running / completed / failed / paused)
- **Real-time logs** — Event streaming for in-progress runs via WebSocket
- **Node detail** — Output, attempts, duration, errors
- **Approvals** — Approve/reject buttons for pending `approval` nodes

The HTTP API between Web UI and core is internal (same process). No public REST API in v1.

## MCP Server (`packages/mcp`) — Primary Interface

MCP server exposing cc-framework to Claude Code. This is the main way users interact with the framework.

| Tool          | Description                                        |
| ------------- | -------------------------------------------------- |
| `ccf_init`    | Initialize `.cc-framework/` in the current project |
| `ccf_run`     | Run a workflow with arguments                      |
| `ccf_list`    | List available workflows (embedded + custom)       |
| `ccf_status`  | Get run status (all runs or specific run detail)   |
| `ccf_resume`  | Resume a paused (approval) or failed run           |
| `ccf_approve` | Approve a pending approval node                    |
| `ccf_reject`  | Reject a pending node with reason                  |
| `ccf_logs`    | Get run logs                                       |

## Default Workflows (`packages/workflows`)

| Workflow    | Description                                                    |
| ----------- | -------------------------------------------------------------- |
| `fix-issue` | Investigate a GitHub issue, plan, implement, test, create PR   |
| `feature`   | Idea to PR — plan, iterative implementation, tests, review, PR |
| `review`    | Multi-aspect PR review (code, tests, security) with synthesis  |
| `refactor`  | Refactoring with behavior preservation verification            |
| `test`      | Analyze coverage, generate missing tests                       |
| `assist`    | General codebase Q&A, interactive debugging                    |

## Distribution

MCP server distributed as an npm package. Users add it to their Claude Code MCP config. Core + MCP Server + default workflows are bundled together.

**Runtime dependency:** `@anthropic-ai/claude-agent-sdk` — required for AI node execution. The user must have an Anthropic API key configured (`ANTHROPIC_API_KEY` env var) or be authenticated via Claude Code (`claude login`). cc-framework does not manage or proxy authentication.
