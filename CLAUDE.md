## Codebase Discovery

Before exploring or modifying code, call `get_architecture(project: "home-aperrix-Documents-PROJECTS-cc-framework")` from codebase-memory-mcp to load the package structure, dependency graph, and key entry points. Use `search_graph` and `get_code_snippet` for code navigation — fall back to Grep/Read only for non-code files (configs, YAML, markdown).

## Project Overview

**Deterministic workflow engine for AI-assisted development.** Runs multi-step YAML workflows as DAGs via Claude Code (MCP tools) or CLI. Built with **TypeScript + SQLite/PostgreSQL (drizzle-orm) + Vite+**.

**MCP-first architecture:** The MCP server is the primary interface — users interact with cc-framework through Claude Code via MCP tools. The CLI (`ccf`) is secondary (useful for CI/CD or manual testing).

## Core Principles

**Type Safety (CRITICAL)**

- Strict TypeScript configuration enforced
- All functions must have complete type annotations
- No `any`. No type assertions. No enums (use `as const` instead).
- Interfaces for all major abstractions

**Zod Schema Conventions**

- Schema naming: camelCase, descriptive suffix (e.g., workflowRunSchema, errorSchema)
- Type derivation: always use z.infer<typeof schema> — never write parallel hand-crafted interfaces

**Git as First-Class Citizen**

- Let git handle what git does best (conflicts, uncommitted changes, branch management)
- Surface git errors to users for actionable issues (conflicts, uncommitted changes)
- Handle expected failure cases gracefully (missing directories during cleanup)
- Trust git's natural guardrails (e.g., refuse to remove worktree with uncommitted changes)
- Worktrees enable parallel workflow execution without branch conflicts
- NEVER run git clean -fd - it permanently deletes untracked files (use git checkout . instead)

## Engineering Principles

These are implementation constraints, not slogans. Apply them by default.

**KISS — Keep It Simple, Stupid**

- Prefer straightforward control flow over clever meta-programming
- Prefer explicit branches and typed interfaces over hidden dynamic behavior
- Keep error paths obvious and localized

**YAGNI — You Aren't Gonna Need It**

- Do not add config keys, interface methods, feature flags, or workflow branches without a concrete accepted use case
- Do not introduce speculative abstractions without at least one current caller
- Keep unsupported paths explicit (error out) rather than adding partial fake support

**DRY + Rule of Three**

- Duplicate small, local logic when it preserves clarity
- Extract shared utilities only after the same pattern appears at least three times and has stabilized
- When extracting, preserve module boundaries and avoid hidden coupling

**SRP + ISP — Single Responsibility + Interface Segregation**

- Keep each module and package focused on one concern
- Extend behavior by implementing existing narrow interfaces (IAgentProvider, IWorkflowStore, WorkflowConfig) whenever possible
- Avoid fat interfaces and "god modules" that mix policy, transport, and storage
- Do not add unrelated methods to an existing interface — define a new one

**Fail Fast + Explicit Errors — Silent fallback in agent runtimes can create unsafe or costly behavior**

- Prefer throwing early with a clear error for unsupported or unsafe states — never silently swallow errors
- Never silently broaden permissions or capabilities
- Document fallback behavior with a comment when a fallback is intentional and safe; otherwise throw

**Determinism + Reproducibility**

- Prefer reproducible commands and locked dependency behavior in CI-sensitive paths
- Keep tests deterministic — no flaky timing or network dependence without guardrails
- Ensure local validation commands (`vp check && vp test --run`) map directly to CI expectations

**Reversibility + Rollback-First Thinking**

- Keep changes easy to revert: small scope, clear blast radius
- For risky changes, define the rollback path before merging
- Avoid mixed mega-patches that block safe rollback

## Essential Commands

### Development

```bash
vp install          # Install all workspace dependencies (run after pulling)
vp dev              # Start dev server (if applicable)
```

### Testing

```bash
vp test             # Run all tests (Vitest, watch mode)
vp test --coverage  # Run all tests, with coverage
```

Tests live in `packages/*/tests/**/*.test.ts`. Import test utilities from `vite-plus/test`:

```typescript
import { describe, test, expect, vi, beforeEach } from "vite-plus/test";
```

### Type Checking, Linting & Formatting

```bash
vp check            # Run fmt + lint + type-check (all at once)
vp check --fix      # Same, with auto-fix
vp lint             # Lint only (Oxlint, type-aware)
vp fmt              # Format only (Oxfmt)
```

### Pre-commit Validation

**Always run before creating a commit or pull request:**

```bash
vp check && vp test --run
```

### Oxlint Guidelines

- `no-console` is enforced as an error. Only `console.error`, `console.warn`, and `console.debug` are allowed.
- Use `createLogger()` from `@cc-framework/utils` instead of `console.log`.
- Type-aware linting is enabled by default via `vp lint --type-aware`.

### Configuration

Resolution order (later overrides earlier): built-in defaults → global `~/.cc-framework/config.yaml` → project `.cc-framework/config.yaml` → env vars (`CCF_MODEL`, `CCF_HOME`).

Key fields: `model`, `effort` (`low`|`medium`|`high`|`max`), `isolation.strategy` (`branch`|`worktree`), `isolation.branch_prefix`, `databaseUrl`.

### Database

- **SQLite** (default) — stored at `~/.cc-framework/cc-framework.db` (auto-initialized on first use, zero setup).
- **PostgreSQL** — set `databaseUrl` in config (`postgres://...`). Detected via `isPostgresUrl()`, created via `createDatabaseFromUrl()`.
- Schema defined via drizzle-orm in `packages/workflows/src/store/database.ts`.
- No migrations — tables are auto-created on first access.

### CLI (for manual testing)

```bash
ccf init                              # Initialize .cc-framework/ in cwd
ccf run fix-issue --arg "Fix #42"     # Run a workflow
ccf list                              # List available workflows
ccf status [runId]                    # Show session runs or specific run
ccf resume <runId>                    # Resume failed/paused run
ccf approve <runId> <nodeId>          # Approve approval gate
ccf reject <runId> <nodeId> --reason "..."
ccf logs <runId>                      # Event timeline
```

## Workflow System

### YAML Format

Workflows are DAGs defined in YAML. Each node has exactly one type:

| Key         | Description                                                | Output         |
| ----------- | ---------------------------------------------------------- | -------------- |
| `prompt:`   | AI prompt (inline or file from `.cc-framework/prompts/`)   | AI response    |
| `script:`   | Shell/TS/Python (`runtime:` required: `bash`, `bun`, `uv`) | stdout         |
| `loop:`     | Iterative AI prompt until completion signal                | Last iteration |
| `approval:` | Human gate — pauses until approved/rejected                | User comment   |
| `cancel:`   | Abort the workflow run                                     | —              |

**Node features:** `depends_on`, `when:` conditions (`$nodeId.output.field == 'value'`), `trigger_rule` (`all_success`, `one_success`), `output_format` (structured JSON validation), `retry` (transient errors), `allowed_tools`/`denied_tools`, `isolation`, `execution: code`.

**Variables:** `$ARGUMENTS`, `$nodeId.output`, `$nodeId.output.field`, `$ARTIFACTS_DIR`, `$PROMPT_DIR`, `$DOCS_DIR`, `$REJECTION_REASON`.

**Bundled defaults:** `fix-issue`, `feature`, `review`, `refactor`, `test`, `assist`.

### Execution Flow

1. Parse YAML → validate via Zod → build DAG (Kahn's algorithm)
2. Setup isolation (worktree/branch) if configured
3. Execute layers top-down — independent nodes in same layer run in parallel
4. Skip completed nodes on resume (checkpoint recovery)
5. For each node: evaluate `when:` → dispatch to runner → validate `output_format` → persist output
6. On failure: classify error (fatal/transient), retry if retryable
7. Between layers: check run status in DB (supports external cancellation/pause)

### Routing (Deterministic)

- No LLM-based routing inside cc-framework — Claude Code (the host LLM) decides which workflow to invoke via MCP tools.
- The orchestrator does **fuzzy name matching** (4-tier: exact → case-insensitive → suffix → substring) and dispatches.
- `ccf run <workflow>` → direct dispatch. `ccf run` without name → list available workflows.

### Session Transitions

Sessions group workflow runs per working directory. Triggers:

| Trigger             | Behavior                                    |
| ------------------- | ------------------------------------------- |
| `first-message`     | No action (no existing session)             |
| `plan-to-execute`   | Deactivate + immediately create new session |
| `isolation-changed` | Deactivate (next command creates new)       |
| `reset-requested`   | Deactivate                                  |
| `worktree-removed`  | Deactivate                                  |

Exhaustive `Record<TransitionTrigger, Behavior>` ensures compile-time coverage.

### Operations (core)

Centralized business logic in `core/src/operations/` — both CLI and MCP are thin formatting adapters:

- `approveWorkflow(runId, nodeId, store)` — validate paused status + approval context, record event, resume
- `rejectWorkflow(runId, nodeId, store, reason?)` — record rejection event
- `resumeWorkflow(runId, config, store, cwd)` — find workflow on disk, re-execute from checkpoint
- `abandonWorkflow(runId, store)` — cancel non-terminal run
- `getWorkflowStatus(store, sessionId)` — list session runs

Operations **throw on errors** — callers catch and format for their surface.

## Development Guidelines

### Logging

Structured logging via `createLogger(domain)` from `@cc-framework/utils`:

- **Lazy init** — never at module scope: `let log; function getLog() { ... }`
- **Event naming:** `{domain}.{action}_{state}` — e.g. `orchestrator.dispatching_workflow`, `operations.workflow_approved`
- **Log levels:** `error` > `warn` > `info` > `debug`
- **Never log:** API keys, tokens, user message content, PII

### Error Handling

- Custom error classes in `@cc-framework/utils`: `CcfError`, `WorkflowNotFoundError`, `NodeExecutionError`, `ConfigError`, `ValidationError`.
- Operations throw typed errors — callers (CLI/MCP) catch and format.
- Pattern: validate state → throw on violation → caller formats for output surface.

### Testing

- Tests in `packages/*/tests/` mirroring `src/` structure.
- Vitest via `vp test`. Import from `vite-plus/test` (not `vitest`).
- Mock external deps (filesystem, AI SDKs, child_process). Test pure functions directly.
- `vi.mock()` for module mocking, `vi.spyOn()` for method spying.
