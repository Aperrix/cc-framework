# Session Handoff: Orchestrator + Session State Machine

## Project Context

**cc-framework** — workflow engine déterministe pour le développement logiciel assisté par IA.
**Branch:** `main`
**Stats:** 75 source files, 58 test files, 477 tests, 6 packages

## Architecture actuelle

```
cli ──→ core (config, loadConfig)
cli ──→ workflows (engine) ──→ utils (logger, paths, sanitizer, errors)
mcp ──→ core                    └──→ providers (Claude, Codex)
mcp ──→ workflows
```

### Ce qui existe dans core aujourd'hui

```
packages/core/src/
├── config/loader.ts     — loadConfig, initProject, ensureGlobalHome
├── config/types.ts      — ResolvedConfig, GlobalConfig, ProjectConfig, SafeConfig
├── store-adapter.ts     — toWorkflowConfig (bridge ResolvedConfig → WorkflowConfig)
└── index.ts
```

Core est presque vide — il ne contient que la config et un adaptateur. L'orchestrateur sera sa première vraie fonctionnalité applicative.

### Ce qui existe dans workflows (l'engine)

L'engine est complet et fonctionnel :

- `WorkflowExecutor` — exécute un workflow parsé, gère le DAG layer-by-layer
- `router.ts` — `resolveWorkflowByName()` (4-tier fuzzy matching) + `parseWorkflowInvocation()`
- `validator.ts` — validation Level 3 des ressources
- `StoreQueries` — persistence SQLite/PostgreSQL
- `discoverWorkflows()` — discovery embedded + global + project
- 6 default workflows — fix-issue, feature, review, refactor, test, assist

### Ce que le CLI fait aujourd'hui (à absorber par l'orchestrateur)

Le CLI dispatche directement les commandes :

- `ccf run <workflow> [args]` → `findWorkflow` + `parseWorkflow` + `executor.run()`
- `ccf resume <runId>` → `store.getRun()` + `findWorkflow` + `executor.resume()`
- `ccf approve <runId>` → `store.resolveApproval(runId, true)`
- `ccf reject <runId>` → `store.resolveApproval(runId, false)`
- `ccf status [runId]` → `store.getRun()` ou `store.getSessionRuns()`
- `ccf list` → `discoverWorkflows(config)`
- `ccf logs <runId>` → `store.getEvents(runId)`
- `ccf init` → `initProject(cwd)`

Il n'y a **pas** de routing intelligent — l'utilisateur doit toujours spécifier le nom du workflow manuellement.

## Ce qu'il faut construire

### 1. Session State Machine (`core/src/state/session-transitions.ts`)

Machine d'état qui gère les transitions de session. Copier le pattern d'Archon.

**Transitions :**

| Trigger             | Comportement                                                 | Exemple                        |
| ------------------- | ------------------------------------------------------------ | ------------------------------ |
| `first-message`     | Aucune action (pas de session à fermer)                      | Premier message dans le projet |
| `plan-to-execute`   | Ferme la session courante ET crée immédiatement une nouvelle | Plan validé → exécution        |
| `isolation-changed` | Désactive la session courante (la prochaine en créera une)   | Changement de worktree         |
| `reset-requested`   | Désactive la session courante                                | Commande `/reset`              |
| `worktree-removed`  | Désactive la session courante                                | Worktree supprimé manuellement |

**Fonctions :**

- `shouldCreateNewSession(trigger) → boolean`
- `shouldDeactivateSession(trigger) → boolean`
- `detectPlanToExecuteTransition(commandName, lastCommand) → trigger | null`
- `getTriggerForCommand(command) → trigger | null`

**~80 lignes, fortement typé avec `Record` exhaustif.**

### 2. Workflow Operations (`core/src/operations/workflow-operations.ts`)

Centralise la logique métier approve/reject/resume/abandon/status. Aujourd'hui cette logique est dupliquée dans chaque commande CLI.

**Fonctions :**

- `approveWorkflow(runId, store, response?)` — valide l'approbation, reprend le workflow
- `rejectWorkflow(runId, store, feedback?)` — rejette, cancel ou retry selon `on_reject`
- `resumeWorkflow(runId, store, config)` — reprend un workflow failed/paused
- `abandonWorkflow(runId, store)` — abandonne un workflow en cours
- `getWorkflowStatus(store)` — retourne le statut de tous les runs actifs

**Retourne des résultats typés, ne fait pas de formatage (les commandes CLI formatent).**

### 3. Orchestrateur (`core/src/orchestrator/orchestrator.ts`)

Le cœur : reçoit un message utilisateur, détermine quoi faire, dispatch.

**Flux :**

```
message utilisateur
       │
       ▼
  Est-ce un slash command ?  ──yes──→ command handler
       │ no
       ▼
  Router fuzzy : match un workflow ?  ──yes──→ dispatch workflow
       │ no
       ▼
  Router LLM : classify l'intent  ──→ dispatch workflow ou assist
```

**Fonctions clés :**

- `handleMessage(message, context)` — point d'entrée principal
- `dispatchWorkflow(workflow, args, context)` — lance un workflow avec la bonne config
- `resolveWorkflow(message, workflows)` — combine fuzzy match + LLM routing

**Dépendances :**

- `@cc-framework/workflows` — pour `discoverWorkflows`, `parseWorkflow`, `WorkflowExecutor`, `resolveWorkflowByName`
- `@cc-framework/providers` — pour le LLM routing (classification d'intent)
- `core/config` — pour `ResolvedConfig`
- `core/state` — pour la session state machine
- `core/operations` — pour approve/reject/resume

### 4. Prompt Builder (`core/src/orchestrator/prompt-builder.ts`)

Construit le system prompt pour le LLM routing.

**Fonctions :**

- `buildRoutingPrompt(workflows, userMessage)` — prompt qui demande au LLM de choisir un workflow
- `formatWorkflowSection(workflows)` — liste les workflows disponibles avec leurs descriptions

### 5. Intégration CLI et MCP

Après l'orchestrateur, simplifier le CLI :

- `ccf run` sans workflow name → passe par l'orchestrateur qui route automatiquement
- `ccf run <workflow>` → toujours direct (bypass orchestrateur)
- MCP tools : ajouter un tool `dispatch` qui utilise l'orchestrateur

## Fichiers à créer

```
packages/core/src/
├── state/
│   └── session-transitions.ts     (~80 lignes)
├── operations/
│   └── workflow-operations.ts     (~200 lignes)
├── orchestrator/
│   ├── orchestrator.ts            (~300 lignes)
│   └── prompt-builder.ts          (~100 lignes)
├── config/...                     (existant)
├── store-adapter.ts               (existant)
└── index.ts                       (mettre à jour)
```

Tests correspondants dans `packages/core/tests/`.

## Dépendances à ajouter

`packages/core/package.json` devra dépendre de :

- `@cc-framework/workflows` — pour l'engine (direction `core → workflows`, comme Archon)
- `@cc-framework/providers` — pour le LLM routing

## Ordre d'implémentation recommandé

1. **Session transitions** — petit, autonome, testable indépendamment
2. **Workflow operations** — extraire la logique des commandes CLI
3. **Prompt builder** — petit, pas de deps
4. **Orchestrateur** — assemble le tout
5. **Intégration CLI/MCP** — câblage final

## Références Archon

Utiliser codebase-memory-mcp pour explorer :

- `home-aperrix-Documents-PROJECTS-archon` — projet Archon indexé
- `packages/core/src/state/session-transitions.ts` — state machine complète
- `packages/core/src/operations/workflow-operations.ts` — approve/reject/resume/abandon
- `packages/core/src/orchestrator/orchestrator.ts` — dispatch, isolation, routing
- `packages/core/src/orchestrator/orchestrator-agent.ts` — handleMessage, LLM interaction
- `packages/core/src/orchestrator/prompt-builder.ts` — system prompts
