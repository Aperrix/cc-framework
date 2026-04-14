# Prompt de démarrage — Implémentation de l'orchestrateur

Copie ce prompt pour démarrer la prochaine session :

---

Lis le fichier docs/superpowers/plans/session-handoff-orchestrator.md — c'est le contexte complet du
projet cc-framework et les instructions pour cette phase : créer l'orchestrateur et la session state
machine dans packages/core/.

Avant de coder, analyse en profondeur l'orchestrateur d'Archon via codebase-memory
(projet: home-aperrix-Documents-PROJECTS-archon) pour comprendre :

1. `packages/core/src/state/session-transitions.ts` — la state machine complète
2. `packages/core/src/operations/workflow-operations.ts` — approve/reject/resume/abandon
3. `packages/core/src/orchestrator/orchestrator.ts` — dispatch workflow, isolation resolution
4. `packages/core/src/orchestrator/orchestrator-agent.ts` — handleMessage, LLM routing
5. `packages/core/src/orchestrator/prompt-builder.ts` — construction des system prompts

Adapte à notre architecture (cc-framework est CLI + MCP, pas un bot multi-platform).
Implémente dans l'ordre : session transitions → workflow operations → prompt builder → orchestrateur → intégration CLI.
