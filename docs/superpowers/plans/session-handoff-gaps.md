# Session Handoff: Remaining Archon Alignment Gaps

## Project Context

**cc-framework** — workflow engine for AI-assisted development.
**Branch:** `main`
**Previous session:** Created 6 default workflows, restructured to vertical slice architecture, added router/validator/utils, analyzed all Archon gaps.

## Ce qui est fait

### Architecture

- Vertical slice: `utils` → `core` → `workflows` → `cli`/`mcp`
- 46 test files, 346 tests, all passing
- ADR documented in `.codebase-memory/adr.md`

### Gaps comblés (cette session)

- `router.ts` — fuzzy name resolution + `/invoke-workflow` parsing
- `validator.ts` — Level 3 resource validation
- `utils/idle-timeout.ts` — deadlock detector
- `utils/duration.ts` — formatDuration + parseDbTimestamp
- `utils/tool-formatter.ts` — tool call formatting
- `validation-parser.ts` — markdown validation table parsing
- `store/types.ts` — IWorkflowStore trait interface

## Ce qu'il reste à faire — 4 gaps prioritaires

### 1. Hooks Schema Strict (demandé: immédiat)

Remplacer `hooks: z.record(z.string(), z.unknown()).optional()` dans `schema/node.ts` par un schema strict comme Archon's `schemas/hooks.ts`.

**Spec:**

- Définir un `z.enum` des événements SDK supportés (`PreToolUse`, `PostToolUse`, `Notification`, etc.)
- Chaque événement map vers `z.array(hookMatcherSchema)`
- `hookMatcherSchema`: `{ matcher?: string, response: Record<string, unknown>, timeout?: number }`
- Utiliser `.strict()` pour rejeter les typos

**Référence:** `/home/aperrix/Documents/PROJECTS/archon/packages/workflows/src/schemas/hooks.ts`
**Fichier à modifier:** `packages/workflows/src/schema/node.ts` (remplacer le champ `hooks`)

### 2. Runtime State Zod Schemas (demandé: immédiat)

Ajouter des Zod schemas pour les types runtime au lieu de simples `as const`:

- `WorkflowRunStatus` — schema Zod enum
- `NodeState` / `NodeOutput` — discriminated union avec state-dependent fields
- `WorkflowRun` — schema complet pour validation runtime
- `ApprovalContext` — avec type guard `isApprovalContext()`
- `ArtifactType` — enum schema
- Assertion compile-time que `NodeOutput` couvre tous les `NodeState` values

**Référence:** `/home/aperrix/Documents/PROJECTS/archon/packages/workflows/src/schemas/workflow-run.ts`
**Fichier à créer:** `packages/workflows/src/schema/workflow-run.ts`
**Fichiers à modifier:** `packages/workflows/src/constants.ts` (garder les constantes, ajouter les schemas)

### 3. Script Dependencies Resolution (demandé: immédiat)

Ajouter le support du champ `deps` sur les script nodes pour installer automatiquement les dépendances avant l'exécution.

**Spec:**

- Le champ `deps` dans le schema est déjà défini (`z.array(z.string()).optional()`)
- Dans `script-runner.ts`, avant d'exécuter un script, vérifier si `deps` est défini
- Si oui, installer les dépendances selon le runtime:
  - `bash`: pas de deps (ignorer)
  - `bun`: `bun add --dev <deps>` ou `bun install`
  - `uv`: `uv pip install <deps>`
- Logger l'installation avec le structured logger
- Cacher l'info pour ne pas réinstaller si déjà présent

**Référence:** `/home/aperrix/Documents/PROJECTS/archon/packages/workflows/src/script-discovery.ts` (fonction `resolveScriptDeps`)
**Fichier à modifier:** `packages/workflows/src/runners/script-runner.ts`

### 4. PostgreSQL Support (demandé: immédiat)

Ajouter le support PostgreSQL en plus de SQLite via Drizzle ORM.

**Spec:**

- Drizzle ORM supporte déjà PostgreSQL (`drizzle-orm/pg-core`)
- Ajouter un adaptateur PostgreSQL dans `store/`:
  - `store/pg-database.ts` — connexion PostgreSQL
  - Ou adapter `store/database.ts` pour supporter les deux backends
- Config: `databaseUrl` dans `ResolvedConfig` (env var `CCF_DATABASE_URL`)
- Si URL commence par `postgres://` → PostgreSQL, sinon → SQLite
- Le schema Drizzle doit fonctionner pour les deux backends
- Ajouter `pg` ou `postgres` comme dépendance optionnelle

**Référence:** `/home/aperrix/Documents/PROJECTS/archon/packages/core/src/db/adapters/` (sqlite.ts, postgres.ts, types.ts)
**Fichiers à modifier:** `packages/workflows/src/store/database.ts`, `packages/workflows/package.json`
**Note:** Notre schema Drizzle utilise `sqliteTable` — il faudra soit abstractiser, soit dupliquer pour `pgTable`

### 5. JSONL File Logger (réponse #7)

Ajouter la persistence des logs de workflow sur disque en JSONL, comme Archon.

**Spec:**

- Créer `packages/workflows/src/file-logger.ts`
- Append events au fichier `${artifactsDir}/../logs/${runId}.jsonl`
- Interface `WorkflowEvent`: type, workflow_id, step?, content?, ts, duration_ms?, error?
- Fonctions: `logWorkflowEvent()`, intégrée dans l'executor via les hooks d'événements
- Non-bloquant: ne jamais throw si l'écriture échoue

**Référence:** `/home/aperrix/Documents/PROJECTS/archon/packages/workflows/src/logger.ts`

### 6. Multi-Provider Support (réponse #8)

Créer `packages/providers/` — abstraction multi-LLM (Claude + Codex pour le moment, comme Archon).

**Spec:**

- Interface `IAgentProvider`: `query()`, `stream()`, capabilities
- Registre de providers avec `registerProvider()` / `getRegisteredProviders()`
- Provider Claude: wrapper Claude Agent SDK (existant dans `ai-runner.ts`)
- Provider Codex: wrapper OpenAI Codex SDK
- `inferProviderFromModel(model)` — détermine le provider depuis le nom du modèle
- `isModelCompatible(provider, model)` — valide la compatibilité
- Utilisé pour adversarial coding (implémentation Claude, review Codex) et review multi-modèle

**Référence:** `/home/aperrix/Documents/PROJECTS/archon/packages/providers/`
**Package à créer:** `packages/providers/`
**Fichiers impactés:** `packages/workflows/src/runners/ai-runner.ts` (remplacer l'import direct Claude Agent SDK par l'abstraction provider)

### 7. Per-Node Parsing (réponse #14)

Refactorer `parse-workflow.ts` pour parser les nœuds un par un au lieu de tout d'un coup.

**Spec:**

- Chaque nœud est parsé individuellement avec son propre contexte d'erreur
- Si un nœud échoue la validation, le message d'erreur inclut le nodeId et le champ fautif
- Les nœuds valides sont collectés même si d'autres échouent (mode "collect all errors")
- Résolution des prompt files per-node (async, comme Archon's `loader.ts`)
- Retourner `{ workflow, errors }` au lieu de throw

**Raison technique (Archon):** Les nœuds `command:` référencent des fichiers markdown externes chargés async. Le parsing per-node permet de rapporter exactement quel nœud a un fichier manquant. Notre approche actuelle throw sur la première erreur et ne montre pas les autres.

**Référence:** `/home/aperrix/Documents/PROJECTS/archon/packages/workflows/src/loader.ts`
**Fichier à modifier:** `packages/workflows/src/parser/parse-workflow.ts`

## Outils disponibles

- **codebase-memory-mcp** — cc-framework indexé, Archon indexé
- **context-mode** — pour les commandes avec output volumineux
- Archon refs disponibles pour comparaison directe
