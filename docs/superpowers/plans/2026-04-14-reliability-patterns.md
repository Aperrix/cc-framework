# Reliability Patterns — Insights from Research

> Source articles:
>
> - Mihail Eric: "The Emperor Has No Clothes" — AI agents are ~200 LOC, value is in orchestration
> - Thorsten Ball (Ampcode): "How to Build an Agent" — agent = LLM + loop + tools, return errors to model
> - Karpathy's "March of Nines" — 10 steps at 98% = 82% end-to-end, each nine costs as much as all before

## Key Insight: cc-framework's Value Proposition

The agent loop is commodity code (~200 LOC, handled by the Claude Agent SDK). cc-framework's value is the **deterministic orchestration layer** above it — DAG structure, retry, checkpoint, approval gates, and reproducibility via YAML.

## March of Nines — The Math

| Steps | Per-step reliability | End-to-end |
| ----- | -------------------- | ---------- |
| 10    | 98%                  | 82%        |
| 10    | 95%                  | 60%        |
| 10    | 99%                  | 90%        |
| 10    | 99.9%                | 99%        |

Each "nine" of improvement (90% -> 99% -> 99.9%) costs as much as everything before it.

## Implemented Patterns

All patterns from the original "Already Implemented" and "Implement Now" lists are complete, plus several from the v2 roadmap.

### Core Patterns (implemented from day one)

- **Bounded workflows with strict interfaces** — DAG structure + Zod schema validation (`packages/workflows/src/schema/`)
- **Deterministic fallbacks** — Script nodes (bash/bun/uv) at ~100% reliability via `script-runner.ts`
- **Resumable workflows** — Checkpoint/resume via SQLite-persisted state in `executor.ts`
- **Human-in-the-loop** — Approval nodes with `on_reject` retry in `approval-runner.ts`
- **Retry with exponential backoff** — `executor.ts` implements `delay * 2^(attempt-1)` with configurable `max_attempts` (1-5) and `delay_ms` (1000-60000ms)
- **Error classification** — `error-classifier.ts`: `classifyError()` categorizes errors as `fatal` (auth, permission, billing), `transient` (rate limit, timeout, network), or `unknown`. `isRetryable()` checks classification against retry scope (`transient` or `all`)
- **Event-based observability** — `WorkflowEventBus` emits typed events: `node:start`, `node:complete`, `node:error`, `node:skipped`, `run:progress`, `run:done`, `approval:request`

### Patterns from "Implement Now" (all done)

- **Inter-node output validation** — `validate-output.ts`: `validateNodeOutput()` checks node output against `output_format` JSON schema (valid JSON, required fields, enum values). Runs before passing output to downstream nodes.
- **Aggregated metrics** — `StoreQueries` in `queries.ts` provides run/node statistics for identifying failure patterns
- **AI runner error resilience** — Handled at the executor level; transient errors trigger retries rather than immediate failure

### Patterns from v2 roadmap (implemented)

- **Code Mode execution** — `code-mode-runner.ts`: `runCodeMode()` has the LLM generate a complete executable script instead of making tool calls. Activated via `execution: code` on prompt nodes. Includes `buildCodeModeSystemPrompt()` for runtime-specific instructions and `extractCode()` for parsing LLM output. Supports bash/bun/uv runtimes.
- **Idle timeout** — `idle-timeout.ts`: `withIdleTimeout()` wraps promises with a configurable timeout (default: 30 minutes). Prevents hung AI processes from blocking workflows indefinitely. Fires optional `onTimeout` callback for subprocess cleanup. Throws `IdleTimeoutError` on timeout.

## Remaining v2 Patterns

### Circuit Breaker

If a node fails N times in a row with the same transient error pattern, stop retrying and mark the run as "circuit open" instead of exhausting all retries. Not yet implemented — the current retry logic exhausts all attempts before failing.

### Risk Tagging

Optional `risk: "low" | "medium" | "high"` on nodes. High-risk nodes would auto-require approval gates or sandboxing. Not yet implemented — sandbox support exists per-node but is not auto-applied based on risk level.

### Schema Validation Pipeline (full version)

The basic version (output validation against `output_format`) is implemented. The full pipeline — declaring input expectations per node and validating that upstream outputs match downstream expectations at parse time — is not yet implemented.

### Anthropic PTC Integration

Enable Programmatic Tool Calling on AI nodes that declare many tools. Pass `allowed_callers: ["code_execution_20260120"]` on tool definitions. Not yet integrated — Code Mode provides similar benefits via a different mechanism (full script generation rather than SDK-level PTC).
