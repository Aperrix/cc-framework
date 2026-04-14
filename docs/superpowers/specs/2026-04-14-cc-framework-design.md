# cc-framework — Design Specification

## Overview

cc-framework is a deterministic workflow engine for AI-assisted software development. It orchestrates AI agents through YAML-defined DAGs (Directed Acyclic Graphs), providing structure, repeatability, and auditability to AI coding workflows.

**Core principle:** Workflows are 100% manually authored in YAML. The AI fills intelligence within deterministic steps — it does not control the structure.

**Runtime:** The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) is the primary AI runtime. Each AI node spawns an autonomous agent via the SDK, with full access to file editing, shell commands, and codebase analysis. Multi-provider support is available via the `@cc-framework/providers` package (Claude + Codex).

**ToS compliance:** cc-framework does not proxy or manage authentication. Users must provide their own API keys or be authenticated via Claude Code (`claude login`). The SDK handles authentication directly — cc-framework passes prompts and configuration, never credentials.

## Architecture

### Monorepo — 6 Packages

| Package                   | Type        | Description                                                            |
| ------------------------- | ----------- | ---------------------------------------------------------------------- |
| `@cc-framework/utils`     | Library     | Logger, paths, error types, credential sanitizer. Zero domain deps.    |
| `@cc-framework/core`      | Library     | Config loader, store adapter. Foundation consumed by workflows.        |
| `@cc-framework/providers` | Library     | Multi-provider AI agent abstraction (Claude, Codex). Registry pattern. |
| `@cc-framework/workflows` | Library     | Self-contained workflow engine: schema, DAG, executor, runners, store. |
| `@cc-framework/cli`       | Application | CLI binary (`ccf`) — 8 commands wrapping the workflows package.        |
| `@cc-framework/mcp`       | Application | MCP server binary (`ccf-mcp`) — 8 tools for Claude Code integration.   |

### Dependency Graph

```
cli  mcp
 \   /
workflows → core → (yaml)
    ↓
 providers → (claude-agent-sdk)
    ↑
  utils
```

**Vertical Slice Principle:** `@cc-framework/workflows` is self-contained — it has its own store, schemas, discovery, isolation, runners, and bundles default workflows. CLI and MCP import only from `@cc-framework/workflows` (which re-exports core types for convenience). They never import from `@cc-framework/core` directly.

## Package Details

### `@cc-framework/utils`

Zero-dependency foundation. Modules:

- `logger.ts` — Structured logger with `createLogger()`, log levels, custom writers
- `paths.ts` — Standard path resolution: `getCcfHome()`, global/project config/workflows/prompts/scripts/database paths, run artifacts and log paths
- `error.ts` — Domain error types: `CcfError`, `WorkflowNotFoundError`, `NodeExecutionError`, `ConfigError`, `ValidationError`, `formatError()`
- `credential-sanitizer.ts` — `sanitize()`, `sanitizeSync()`, `addPattern()` for stripping secrets from logs
- `strip-cwd-env.ts` — `stripClaudeCodeMarkers()` for cleaning agent output

### `@cc-framework/core`

Foundation layer. Dependencies: `yaml`.

- `config/loader.ts` — `loadConfig()`, `initProject()`, `ensureGlobalHome()`. Hierarchical merge: built-in defaults, global YAML (`~/.cc-framework/config.yaml`), project YAML (`.cc-framework/config.yaml`), environment variables.
- `config/types.ts` — `GlobalConfig`, `ProjectConfig`, `ResolvedConfig`, `SafeConfig`, `CONFIG_DEFAULTS`, `toSafeConfig()`
- `store-adapter.ts` — `toWorkflowConfig()` — adapts resolved config for the workflow engine

### `@cc-framework/providers`

Multi-provider AI abstraction. Dependencies: `@anthropic-ai/claude-agent-sdk`.

- `types.ts` — `IAgentProvider` interface: `query()`, `stream()`, `ProviderCapabilities`, `QueryOptions`, `QueryResult`
- `registry.ts` — Provider registry: `registerProvider()`, `getRegisteredProviders()`, `inferProviderFromModel()`, `isModelCompatible()`
- `claude-provider.ts` — `ClaudeProvider` implementing `IAgentProvider` via Claude Agent SDK
- `codex-provider.ts` — `CodexProvider` implementing `IAgentProvider` via OpenAI Codex SDK

### `@cc-framework/workflows`

Self-contained workflow engine. The largest package. Dependencies: `@cc-framework/core`, `@anthropic-ai/claude-agent-sdk`, `better-sqlite3`, `drizzle-orm`, `zod`.

#### Schema (`schema/`)

- `workflow.ts` — `WorkflowSchema`: top-level Zod schema (name, description, provider, model, effort, thinking, isolation, inputs, nodes, etc.)
- `node.ts` — `NodeSchema`: node definition with 5 mutually exclusive types, base properties, type guards
- `common.ts` — Shared schemas: `TriggerRuleSchema`, `RetrySchema`, `IsolationSchema`, `OutputFormatSchema`, `SandboxSchema`, `ThinkingConfigSchema`, `InputDefinitionSchema`, `WhenConditionSchema`
- `hooks.ts` — `NodeHooksSchema`, `HookMatcherSchema` for per-node SDK hooks
- `workflow-run.ts` — Runtime status schemas: `WorkflowRunStatusSchema`, `NodeExecutionStatusSchema`, `ApprovalContextSchema`
- `generate-json-schema.ts` — JSON Schema generation from Zod for IDE autocompletion

#### Parser (`parser/`)

- `parse-workflow.ts` — `parseWorkflow()`, `parseWorkflowSafe()` — YAML load + Zod validation + prompt file resolution

#### DAG (`dag/`)

- `build-dag.ts` — `buildDag()` — Kahn's algorithm for topological sort, cycle detection, parallel layer computation

#### Variables (`variables/`)

- `substitute.ts` — `substituteVariables()` — resolves `$nodeId.output`, `$ARGUMENTS`, `$ARTIFACTS_DIR`, JSON dot notation

#### Executor (`executor/`)

- `executor.ts` — `WorkflowExecutor` class: DAG traversal, layer-by-layer execution, retry with exponential backoff, checkpoint/resume, session threading, status checks between layers
- `condition-evaluator.ts` — `evaluateCondition()`, `checkTriggerRule()` for `when:` and trigger rule evaluation
- `validate-output.ts` — `validateNodeOutput()` — validates node output against `output_format` JSON schema
- `node-dispatcher.ts` — `dispatchNode()` — routes nodes to the correct runner based on type
- `resolve-model.ts` — `resolveModel()` — model resolution with per-node overrides and fallbacks

#### Runners (`runners/`)

- `ai-runner.ts` — `runAi()` — Claude Agent SDK `query()` wrapper for prompt nodes
- `code-mode-runner.ts` — `runCodeMode()` — LLM generates executable code instead of tool calls, executed via script runner
- `script-runner.ts` — `runScript()`, `installDeps()` — bash/bun/uv script execution via `execFile()`
- `loop-runner.ts` — `runLoop()` — iterative AI execution with `until` signal and `max_iterations`
- `approval-runner.ts` — `requestApproval()` — DB-backed pause/resume with `on_reject` retry
- `cancel-runner.ts` — `runCancel()`, `WorkflowCancelledError` — stops workflow with reason
- `error-classifier.ts` — `classifyError()`, `isRetryable()` — fatal vs transient error classification

#### Store (`store/`)

- `database.ts` — Drizzle ORM table definitions over SQLite (better-sqlite3). 8 tables.
- `queries.ts` — `StoreQueries` class: typed CRUD operations, metrics, session management
- `create-database.ts` — `createDatabaseFromUrl()`, `isPostgresUrl()` — database connection factory
- `session-context.ts` — `buildSessionContext()`, `formatSessionContext()` for session history
- `types.ts` — `IWorkflowStore`, `WorkflowRunRecord`, `NodeOutputRecord` interfaces

#### Events (`events/`)

- `event-bus.ts` — `WorkflowEventBus` (typed EventEmitter): `node:start`, `node:complete`, `node:error`, `node:skipped`, `run:progress`, `run:done`, `approval:request`

#### Isolation (`isolation/`)

- `isolation.ts` — `setupIsolation()`, `cleanupIsolation()`, `listWorktrees()`, `cleanupOrphanedWorktrees()`, `cleanupToMakeRoom()`

#### Discovery (`discovery/`)

- `workflows.ts` — `discoverWorkflows()`, `findWorkflow()` — multi-stage: embedded defaults, global, project (later overrides earlier)
- `prompts.ts` — `resolvePromptWithConfig()` — prompt file resolution from `.cc-framework/prompts/` or project root
- `scripts.ts` — `discoverScripts()`, `findScript()` — script file discovery

#### Utils (`utils/`)

- `idle-timeout.ts` — `withIdleTimeout()` — wraps promises with timeout for hung AI processes (default: 30 min)
- `file-path.ts` — `isFilePath()`, `isPromptFilePath()`, `isScriptFilePath()`
- `duration.ts` — `formatDuration()`, `parseDbTimestamp()`
- `tool-formatter.ts` — `formatToolCall()` for logging

#### Other

- `constants.ts` — Centralized `as const` arrays and types: trigger rules, retry modes, isolation strategies, effort levels, context modes, script runtimes, execution modes, reasoning efforts, web search modes, run/node statuses, etc.
- `deps.ts` — `WorkflowConfig`, `WorkflowPaths` — narrow config interface
- `logger.ts` — Workflow-specific structured logging: `logWorkflowStart()`, `logWorkflowComplete()`, `logNodeStart()`, etc.
- `file-logger.ts` — File-based event logging for audit trails
- `router.ts` — `resolveWorkflowByName()`, `parseWorkflowInvocation()` for workflow routing
- `validator.ts` — `validateWorkflowResources()` — validates prompt/script file references exist
- `validation-parser.ts` — `parseValidationResults()` for structured validation output

## Workflow YAML Specification

### Top-Level Properties

```yaml
name: workflow-name # Required
description: What this workflow does
provider: claude # AI provider (default: claude)
model: sonnet # Model override
modelReasoningEffort: high # minimal / low / medium / high / xhigh
webSearchMode: disabled # disabled / cached / live
additionalDirectories: [] # Extra directories for context
interactive: false # Foreground execution mode
effort: high # low / medium / high / max
thinking: adaptive # adaptive or disabled
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
    type: string # string / number / boolean
    required: true
    description: GitHub issue number
nodes:
  - id: node-id
    # ... node configuration
```

### Node Types

Each node must have exactly one type (mutually exclusive):

| Type       | Syntax                                               | Description                                    |
| ---------- | ---------------------------------------------------- | ---------------------------------------------- |
| `prompt`   | `prompt: "instruction"` or `prompt: path/to/file.md` | AI node — inline text or markdown file path    |
| `script`   | `script: "command"` or `script: path/to/file.sh`     | Deterministic script (bash/bun/uv via runtime) |
| `loop`     | `loop: { prompt, until, max_iterations, ... }`       | Iterative AI execution until signal            |
| `approval` | `approval: { message, capture_response, on_reject }` | Pauses for human review                        |
| `cancel`   | `cancel: "reason"`                                   | Stops the workflow with a reason               |

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
      max_attempts: 2 # 1-5
      delay_ms: 3000 # 1000-60000, doubles each attempt
      on_error: transient # "transient" or "all"
```

### AI Node Properties

```yaml
- id: ai-node
  prompt: investigate-issue.md
  execution: agent # "agent" (default) or "code"
  provider: claude # Per-node provider override
  model: opus # Per-node model override
  maxBudgetUsd: 2.50
  effort: high
  thinking: adaptive
  systemPrompt: "You are..."
  fallbackModel: claude-haiku-4-5-20251001
  betas: ["context-1m-2025-08-07"]
  output_format: # Structured output (validated before downstream)
    type: object
    properties:
      field: { type: string, enum: [A, B] }
    required: [field]
  allowed_tools: [Read, Grep]
  denied_tools: [WebSearch]
  sandbox: { enabled: true }
  hooks: { ... } # SDK hook matchers
  mcp: .cc-framework/mcp/servers.json
  skills: [skill-name]
```

### Loop Nodes

```yaml
- id: iterative-impl
  loop:
    prompt: "Implement the next task. Emit COMPLETE when done."
    until: COMPLETE
    until_bash: "npm test" # Optional bash condition
    max_iterations: 15
    fresh_context: true
    interactive: true # Accept user feedback between iterations
    gate_message: "Provide feedback or say 'done'"
```

### Approval Nodes

```yaml
- id: review-gate
  approval:
    message: "Review the proposed changes."
    capture_response: true
    on_reject:
      prompt: "Fix based on: $REJECTION_REASON"
      max_attempts: 3
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
when: "$nodeId.output == 'VALUE'"
when: "$nodeId.output != 'VALUE'"
when: "$nodeId.output.field == 'VALUE'"
when: "$nodeId.output > '80'"
when: "$a.output == 'X' && $b.output != 'Y'"
when: "$a.output == 'X' || $b.output == 'Y'"
```

Invalid expressions default to `false` (node skipped).

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

Nodes are grouped into topological layers via Kahn's algorithm. Within a layer, all nodes execute in parallel via `Promise.allSettled()`. A node is placed in the earliest layer where all its `depends_on` dependencies are satisfied.

## Database Schema (SQLite via Drizzle ORM)

8 tables defined in `packages/workflows/src/store/database.ts`:

### `workflows`

| Column       | Type        | Description                 |
| ------------ | ----------- | --------------------------- |
| `id`         | TEXT PK     | UUID                        |
| `name`       | TEXT UNIQUE | Workflow name               |
| `source`     | TEXT        | "embedded" or "custom"      |
| `yaml_hash`  | TEXT        | SHA-256 of the YAML content |
| `created_at` | INTEGER     | Unix timestamp              |
| `updated_at` | INTEGER     | Unix timestamp              |

### `sessions`

| Column          | Type    | Description               |
| --------------- | ------- | ------------------------- |
| `id`            | TEXT PK | UUID                      |
| `status`        | TEXT    | open / closed             |
| `project_path`  | TEXT    | Project directory         |
| `metadata`      | TEXT    | JSON metadata (nullable)  |
| `created_at`    | INTEGER | Unix timestamp            |
| `last_activity` | INTEGER | Unix timestamp            |
| `closed_at`     | INTEGER | Unix timestamp (nullable) |

### `runs`

| Column          | Type    | Description                                                 |
| --------------- | ------- | ----------------------------------------------------------- |
| `id`            | TEXT PK | UUID                                                        |
| `workflow_id`   | TEXT FK | References workflows.id                                     |
| `status`        | TEXT    | pending / running / paused / completed / failed / cancelled |
| `arguments`     | TEXT    | JSON-encoded arguments                                      |
| `branch`        | TEXT    | Git branch name (nullable)                                  |
| `worktree_path` | TEXT    | Worktree path (nullable)                                    |
| `started_at`    | INTEGER | Unix timestamp                                              |
| `finished_at`   | INTEGER | Unix timestamp (nullable)                                   |

### `node_executions`

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

### `outputs`

| Column              | Type    | Description                     |
| ------------------- | ------- | ------------------------------- |
| `id`                | TEXT PK | UUID                            |
| `node_execution_id` | TEXT FK | References node_executions.id   |
| `content`           | TEXT    | Output text or JSON             |
| `exit_code`         | INTEGER | Shell node exit code (nullable) |

### `events`

| Column      | Type    | Description                                          |
| ----------- | ------- | ---------------------------------------------------- |
| `id`        | TEXT PK | UUID                                                 |
| `run_id`    | TEXT FK | References runs.id                                   |
| `node_id`   | TEXT    | Node ID (nullable for run-level events)              |
| `type`      | TEXT    | start / complete / error / retry / approval / cancel |
| `payload`   | TEXT    | JSON-encoded event data                              |
| `timestamp` | INTEGER | Unix timestamp                                       |

### `artifacts`

| Column       | Type    | Description                         |
| ------------ | ------- | ----------------------------------- |
| `id`         | TEXT PK | UUID                                |
| `run_id`     | TEXT FK | References runs.id                  |
| `node_id`    | TEXT    | Node ID that produced the artifact  |
| `path`       | TEXT    | File path relative to artifacts dir |
| `created_at` | INTEGER | Unix timestamp                      |

### `isolation_environments`

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

## Default Workflows

6 bundled workflows in `packages/workflows/src/defaults/`:

| Workflow    | Description                                                    |
| ----------- | -------------------------------------------------------------- |
| `fix-issue` | Investigate a GitHub issue, plan, implement, test, create PR   |
| `feature`   | Idea to PR — plan, iterative implementation, tests, review, PR |
| `review`    | Multi-aspect PR review (code, tests, security) with synthesis  |
| `refactor`  | Refactoring with behavior preservation verification            |
| `test`      | Analyze coverage, generate missing tests                       |
| `assist`    | General codebase Q&A, interactive debugging                    |

Workflows are discovered in order: embedded defaults, global (`~/.cc-framework/workflows/`), project (`.cc-framework/workflows/`). Later sources override earlier by name. Prompt files are in `src/defaults/prompts/`, scripts in `src/defaults/scripts/`.

## CLI Commands (`packages/cli`)

Binary: `ccf` (8 commands)

| Command       | Description                                        |
| ------------- | -------------------------------------------------- |
| `ccf init`    | Initialize `.cc-framework/` in the current project |
| `ccf run`     | Run a workflow with arguments                      |
| `ccf list`    | List available workflows (embedded + custom)       |
| `ccf status`  | Get run status (all runs or specific run detail)   |
| `ccf resume`  | Resume a paused or failed run                      |
| `ccf approve` | Approve a pending approval node                    |
| `ccf reject`  | Reject a pending node with reason                  |
| `ccf logs`    | Get run event logs                                 |

Shared utilities in `cli/src/shared/`: `context.ts` (CLI context setup, config loading, database init), `format.ts` (output formatting).

## MCP Tools (`packages/mcp`)

MCP server binary: `ccf-mcp` (8 tools, mirrors CLI)

| Tool          | Description                                        |
| ------------- | -------------------------------------------------- |
| `ccf_init`    | Initialize `.cc-framework/` in the current project |
| `ccf_run`     | Run a workflow by name, execute full DAG           |
| `ccf_list`    | List available workflows with descriptions         |
| `ccf_status`  | Get run status (all runs or specific run detail)   |
| `ccf_resume`  | Resume a paused or failed run                      |
| `ccf_approve` | Approve a pending approval node                    |
| `ccf_reject`  | Reject a pending node with reason                  |
| `ccf_logs`    | Get run event logs                                 |

MCP context (`mcp/src/context.ts`) handles config loading, database setup, and session management.

## Execution Flow

1. **Load config** — Hierarchical merge: defaults, global YAML, project YAML, env vars
2. **Parse** — YAML file loaded, validated via Zod, prompt file references resolved
3. **Build DAG** — Nodes assembled into topological layers via Kahn's algorithm
4. **Setup isolation** — Worktree or branch created based on workflow config (if configured)
5. **Pre-create artifacts** — `$ARTIFACTS_DIR` created on disk for node file outputs
6. **Execute layers** — For each layer:
   a. Skip completed nodes (checkpoint/resume)
   b. Evaluate `when:` conditions, skip non-matching nodes
   c. Run eligible nodes in parallel via `Promise.allSettled()`
   d. Thread session IDs through sequential (single-node) layers
   e. For AI nodes: dispatch to agent mode (`runAi`) or code mode (`runCodeMode`)
   f. Validate structured output against `output_format` schema
   g. On failure: classify error (fatal/transient), retry with exponential backoff if retryable
   h. Persist node output in SQLite for downstream variable substitution
7. **Between layers** — Check run status in DB (supports external cancellation/pause)
8. **Finalize** — Update run status, emit `run:done` event, cleanup isolation if configured

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

## Distribution

MCP server and CLI distributed as npm packages. Users add the MCP server to their Claude Code MCP config. All packages + default workflows are bundled together.

**Runtime dependency:** `@anthropic-ai/claude-agent-sdk` — required for AI node execution. Users must have an Anthropic API key configured (`ANTHROPIC_API_KEY` env var) or be authenticated via Claude Code.
