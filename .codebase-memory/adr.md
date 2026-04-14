# Architecture Decision Record — cc-framework

## Package Structure (Vertical Slice)

Adopted 2026-04-14, inspired by Archon's architecture.

### Packages

| Package                   | Role                                                                                                                                                  | Dependencies |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `@cc-framework/core`      | Shared infrastructure: config loader, logger                                                                                                          | none         |
| `@cc-framework/workflows` | Workflow engine (vertical slice): executor, DAG, parser, schemas, runners, store, discovery, isolation, events, variables + bundled default workflows | core         |
| `@cc-framework/cli`       | CLI interface (`ccf`)                                                                                                                                 | workflows    |
| `@cc-framework/mcp`       | MCP server for Claude Code                                                                                                                            | workflows    |

### Dependency Direction

```
cli/mcp → workflows → core
```

**Current:** `workflows → core` (workflows consumes core's config/logger).
**Archon's pattern:** `core → workflows` (core is the application layer consuming the engine).
**Why the difference:** We don't yet have an application layer (orchestrator, handlers, services). When we do, it will sit above workflows: `orchestrator → workflows → core`.
**Future alignment:** Extract config/logger into a low-level `@cc-framework/paths` package so workflows becomes fully autonomous, then `core` becomes the application layer.

### Vertical Slice Principle

`@cc-framework/workflows` is self-contained:

- Has its own store (database, queries, session management)
- Has its own schemas (Zod validation)
- Has its own discovery (embedded defaults + global + project)
- Bundles default workflows (YAML + prompts) in `src/defaults/`
- Re-exports config types from core for consumer convenience
- Wraps `loadConfig` to inject `DEFAULTS_DIR` automatically

CLI and MCP import ONLY from `@cc-framework/workflows`. They never import from `@cc-framework/core` directly.

### Default Workflows

6 bundled workflows in `packages/workflows/src/defaults/`:

- `fix-issue` — Issue → classify → investigate/plan → implement → validate → PR
- `feature` — Idea → plan → approval → implementation loop → self-review → PR
- `review` — PR → 4 parallel review agents → synthesis
- `refactor` — Scan → analyze (read-only) → plan (read-only) → execute loop → verify behavior → PR
- `test` — Coverage baseline → analyze gaps → generate tests loop → final report
- `assist` — Single interactive prompt node, fallback for unmatched requests

### Future Packages (not yet created)

Following Archon's model, these may be extracted when needed:

- `@cc-framework/paths` — Path resolution, logger (extract from core)
- `@cc-framework/git` — Git operations
- `@cc-framework/isolation` — Worktree/branch isolation (currently in workflows)
- `@cc-framework/providers` — LLM provider abstraction
- `@cc-framework/adapters` — GitHub/forge adapters
