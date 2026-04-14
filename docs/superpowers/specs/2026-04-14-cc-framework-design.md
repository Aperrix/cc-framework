# cc-framework — Design Specification

## Overview

cc-framework is a deterministic workflow engine for AI-assisted software development. It orchestrates Claude Code sessions through YAML-defined DAGs (Directed Acyclic Graphs), providing structure, repeatability, and auditability to AI coding workflows.

**Core principle:** Workflows are 100% manually authored in YAML. The AI fills intelligence within deterministic steps — it does not control the structure.

**Runtime:** Claude Code is the sole AI runtime. No direct API calls, no multi-provider support. The framework orchestrates, Claude Code executes.

## Architecture

### Monorepo with Standalone Distribution

The project is a monorepo with modular packages, compiled into a single standalone binary via `bun build --compile`. Users get one file with zero runtime dependencies.

### Packages

| Package              | Type        | Description                                                                  |
| -------------------- | ----------- | ---------------------------------------------------------------------------- |
| `packages/core`      | Library     | Workflow parser, DAG executor, node runners, SQLite store, event bus. No UI. |
| `packages/cli`       | Application | Terminal interface. Imports core. Entry point for the standalone binary.     |
| `packages/mcp`       | Application | MCP server for Claude Code integration. Exposes workflows as tools.          |
| `packages/workflows` | Data        | Default YAML workflows and markdown commands shipped with the framework.     |
| `apps/web`           | Application | React dashboard. DAG visualization, real-time logs, approval UI.             |

### Dependency Flow

```
CLI, Web UI, MCP Server
        ↓
      Core
        ↓
Claude Code · Shell · Git
```

All three surfaces (CLI, Web, MCP) consume core's programmatic API. Core has no knowledge of its consumers.

## Core Internals (`packages/core`)

### Modules

| Module       | Responsibility                                                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parser/`    | Loads and validates YAML workflow files. Resolves `command:` references from `.cc-framework/commands/`. Produces typed `WorkflowDefinition` objects.                       |
| `dag/`       | Builds the dependency graph from `WorkflowDefinition`. Topological sort, cycle detection, parallel layer computation.                                                      |
| `executor/`  | Traverses the DAG layer by layer. Evaluates `when:` conditions, runs nodes in parallel within a layer, handles retries, checkpoint/resume.                                 |
| `runners/`   | One runner per node type: `ai` (spawns Claude Code), `shell` (executes bash), `loop` (iterates AI runner), `approval` (pauses for human input), `cancel` (stops workflow). |
| `store/`     | SQLite persistence layer via better-sqlite3. Synchronous API.                                                                                                              |
| `isolation/` | Git worktree and branch management. Setup and cleanup per workflow run.                                                                                                    |
| `variables/` | Resolves substitutions in prompts and commands: `$nodeId.output`, `$ARGUMENTS`, `$ARTIFACTS_DIR`, JSON dot notation.                                                       |
| `events/`    | EventEmitter bus for consumers. Emits: `node:start`, `node:complete`, `node:error`, `run:progress`, `run:done`.                                                            |

### Execution Flow

1. **Parse** — YAML file loaded, validated, `command:` references resolved
2. **Build DAG** — Nodes and dependencies assembled into a graph, topological layers computed
3. **Setup isolation** — Worktree or branch created based on workflow config
4. **Execute layers** — For each layer, evaluate `when:` conditions, run eligible nodes in parallel
5. **For each node** — Dispatch to appropriate runner, capture output, store in SQLite
6. **Checkpoint** — After each node completes, persist state for resume capability
7. **Cleanup** — On completion or failure, clean up isolation environment if configured

## Workflow YAML Specification

The workflow spec is based on Archon's workflow format, adapted for the Claude Code runtime.

### Top-Level Properties

```yaml
name: workflow-name
description: What this workflow does
model: sonnet # Claude Code model override
interactive: false # Web UI: run in foreground if true
effort: high # Reasoning depth
thinking: adaptive # Extended thinking mode
fallbackModel: claude-haiku-4-5-20251001
betas: ["context-1m-2025-08-07"]
sandbox:
  enabled: true
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

| Type       | Syntax                         | Description                           |
| ---------- | ------------------------------ | ------------------------------------- |
| `command`  | `command: command-name`        | Loads from `.cc-framework/commands/`  |
| `prompt`   | `prompt: "instruction"`        | Inline prompt                         |
| `bash`     | `bash: "shell script"`         | Deterministic shell execution (no AI) |
| `loop`     | `loop: { prompt, until, ... }` | Iterates until signal                 |
| `approval` | `approval: { message }`        | Pauses for human review               |
| `cancel`   | `cancel: "reason"`             | Stops the workflow                    |

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
    command: my-command
    model: opus # Per-node model override
    output_format: # Structured output
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
    command: create-review-scope

  # These 3 nodes share depends_on: [scope] → parallel execution
  - id: code-review
    command: code-review-agent
    depends_on: [scope]
    context: fresh

  - id: test-review
    command: test-coverage-agent
    depends_on: [scope]
    context: fresh

  - id: security-review
    command: security-review-agent
    depends_on: [scope]
    context: fresh

  # Waits for all 3 reviews
  - id: synthesize
    command: synthesize-reviews
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
│   └── commands/                # Reusable markdown commands
│       └── investigate-issue.md
└── ...
```

### Global Configuration

```
~/.cc-framework/
├── config.yaml                  # Global config (overridable per project)
└── cc-framework.db              # SQLite database
```

Default workflows (shipped with the binary) are available without being copied into the project. Users can override them by creating a file with the same name in `.cc-framework/workflows/`.

## CLI Commands

| Command                          | Description                                        |
| -------------------------------- | -------------------------------------------------- |
| `ccf init`                       | Initialize `.cc-framework/` in the current project |
| `ccf run <workflow>`             | Run a workflow (by name or path)                   |
| `ccf run <workflow> --arg value` | Run with arguments                                 |
| `ccf list`                       | List available workflows (embedded + custom)       |
| `ccf status`                     | Show in-progress and recent runs                   |
| `ccf status <run-id>`            | Detail of a run (nodes, statuses, outputs)         |
| `ccf resume <run-id>`            | Resume a paused (approval) or failed run           |
| `ccf logs <run-id>`              | Show full logs of a run                            |
| `ccf serve`                      | Start the Web UI + API server                      |

## Web UI (`apps/web`)

React dashboard started via `ccf serve`:

- **Run list** — Status, workflow name, duration, filters
- **DAG view** — Interactive graph visualization with nodes colored by status (pending / running / completed / failed / paused)
- **Real-time logs** — Event streaming for in-progress runs via WebSocket
- **Node detail** — Output, attempts, duration, errors
- **Approvals** — Approve/reject buttons for pending `approval` nodes

The HTTP API between Web UI and core is internal (same process). No public REST API in v1.

## MCP Server (`packages/mcp`)

MCP server exposing cc-framework to Claude Code:

| Tool          | Description                       |
| ------------- | --------------------------------- |
| `ccf_run`     | Run a workflow with arguments     |
| `ccf_status`  | Get run status                    |
| `ccf_list`    | List available workflows          |
| `ccf_approve` | Approve a pending node            |
| `ccf_reject`  | Reject a pending node with reason |
| `ccf_logs`    | Get run logs                      |

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

Single standalone binary compiled with `bun build --compile`. Embeds CLI + Core + Web UI + MCP Server + default workflows. One file, zero dependencies.
