# Session Handoff: Default Workflows Implementation

## Project Context

**cc-framework** est un workflow engine déterministe pour le développement logiciel assisté par IA. Il orchestre des sessions Claude Agent SDK via des DAGs définis en YAML.

**Repo:** `/home/aperrix/Documents/PROJECTS/cc-framework`
**Branch:** `main`
**Stats:** 57 commits, 47 source files, 37 test files, 270 tests, 83% coverage

## Architecture

```
packages/core/     → Workflow engine complet (33 source files, 243 tests)
packages/cli/      → CLI `ccf` avec 8 commandes (11 files, 21 tests)
packages/mcp/      → MCP server mince pour Claude Code (3 files, 6 tests)
packages/workflows → À CRÉER — workflows YAML par défaut
```

## Ce qui est fait

### Core — modules implémentés

- `constants.ts` — 15 constantes `as const` + types dérivés
- `config/` — Config hiérarchique (defaults → global YAML → project YAML → env)
- `schema/` — Zod v4, type guards, JSON Schema natif via `z.toJSONSchema()`
- `parser/` — YAML loading + validation structurelle + validation $nodeId.output refs
- `discovery/` — Multi-source : workflows, prompts, scripts (embedded → global → project)
- `dag/` — Kahn's algorithm, couches parallèles, détection cycles
- `executor/` — DAG layer-by-layer, condition evaluator (quote-aware), trigger rules (all_success/one_success/none_failed/all_done), retry avec backoff exponentiel + error classification (fatal/transient), checkpoint/resume, session threading, output validation inter-nœuds, Code Mode (`execution: "code"`), isolation (worktree/branch), activity heartbeat, structured logging
- `runners/` — AI (Claude Agent SDK `query()` avec partial output on error), code-mode (LLM→script→execute), script (bash/bun/uv via `execFile()`), loop (with signal detection), approval (DB-backed pause/resume), cancel, error-classifier
- `store/` — Drizzle ORM, 8 tables (workflows, runs, node_executions, outputs, events, artifacts, isolation_environments, sessions), crash recovery (`failOrphanedRuns`), session management, workflow metrics (`getWorkflowStats`), `findResumableRun`
- `isolation/` — Worktree/branch setup/cleanup, orphan detection, stale worktree pruning
- `logger.ts` — Structured logging pluggable
- `utils/file-path.ts` — `isFilePath`, `isPromptFilePath`, `isScriptFilePath`
- `events/` — Typed EventEmitter, 7 event types
- `store/session-context.ts` — Cross-workflow context (`$SESSION_CONTEXT` variable)
- `executor/resolve-model.ts` — Cascade model resolution (node → workflow → config → default)
- `executor/condition-evaluator.ts` — Quote-aware condition parser with `splitOutsideQuotes`
- `executor/validate-output.ts` — JSON output validation against `output_format` schema
- `executor/node-dispatcher.ts` — Node type routing (extracted from executor)

### CLI — 8 commandes

init, run, list, status, resume, approve, reject, logs

### MCP — 8 tools

ccf_init, ccf_run, ccf_list, ccf_status, ccf_resume, ccf_approve, ccf_reject, ccf_logs

### Node types (5)

- `prompt` — AI node (inline string ou fichier .md), modes: `agent` (default) ou `code`
- `script` — Deterministic (bash/bun/uv), inline ou fichier
- `loop` — Itère un prompt AI jusqu'au signal `until:`
- `approval` — Pause DB-backed, attend approve/reject externe
- `cancel` — Arrête le workflow avec raison

### Innovations cc-framework (pas dans Archon)

- Code Mode (`execution: "code"`) — Cloudflare/PTC pattern
- Output validation inter-nœuds (`validateNodeOutput`)
- Workflow metrics (`getWorkflowStats`)
- AI error resilience (partial output preserved on SDK errors)
- Session management cross-workflow (`$SESSION_CONTEXT`)
- Drizzle ORM (vs raw SQL)
- Unified `script` type (bash+bun+uv fusionnés)

## Ce qu'il reste à faire — Phase: Default Workflows

### Spec (design spec section)

6 workflows par défaut à créer dans `packages/workflows/`:

| Workflow    | Description                                                    |
| ----------- | -------------------------------------------------------------- |
| `fix-issue` | Investigate a GitHub issue, plan, implement, test, create PR   |
| `feature`   | Idea to PR — plan, iterative implementation, tests, review, PR |
| `review`    | Multi-aspect PR review (code, tests, security) with synthesis  |
| `refactor`  | Refactoring with behavior preservation verification            |
| `test`      | Analyze coverage, generate missing tests                       |
| `assist`    | General codebase Q&A, interactive debugging                    |

### Ce que chaque workflow doit contenir

- Un fichier YAML dans `packages/workflows/defaults/`
- Des fichiers prompt .md associés dans `packages/workflows/prompts/`
- Les nœuds utilisent les features implémentées: depends_on, when conditions, trigger_rule, retry, approval gates, output_format, isolation, Code Mode pour les batch tasks

### Contraintes de design

- Les workflows s'inspirent des 20 workflows par défaut d'Archon (indexé dans codebase-memory sous `home-aperrix-Documents-PROJECTS-archon`)
- Utiliser codebase-memory pour naviguer dans le code d'Archon: `search_graph`, `get_code_snippet`, `trace_path`
- Le runtime est le Claude Agent SDK (`query()`) — pas l'API directe
- Les prompt files sont chargés via le discovery system (embedded → global → project override)
- Les workflows doivent être portables (pas de chemins hardcodés)

### Recherche préalable nécessaire

Avant de créer les workflows, analyser les workflows par défaut d'Archon via codebase-memory:

1. `search_graph(query="workflow yaml default")` dans le projet Archon
2. Lire les fichiers YAML dans `.archon/workflows/defaults/`
3. Comprendre la structure, les variables utilisées, les patterns de nœuds

### Configuration Vite+

- Root `vite.config.ts` gère tout (fmt, lint, staged, run, test, coverage)
- Package configs sont vides (héritent du root)
- `vp test run --coverage` pour le coverage
- Coverage thresholds: 70% statements, 60% branches, 70% functions, 70% lines

### Outils disponibles

- **codebase-memory-mcp** — Archon indexé sous `home-aperrix-Documents-PROJECTS-archon`, cc-framework sous `home-aperrix-Documents-PROJECTS-cc-framework`. Utiliser pour TOUTE navigation de code.
- **context-mode** — `ctx_execute` pour les commandes avec output volumineux. NE PAS utiliser WebFetch (bloqué par context-mode hooks), utiliser des subagents pour le web fetching.
- **context7** — Documentation Vite+ sous `/voidzero-dev/vite-plus`
