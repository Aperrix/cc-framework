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

Each "nine" of improvement (90% → 99% → 99.9%) costs as much as everything before it.

## Patterns Already Implemented

- Bounded workflows with strict interfaces (DAG + Zod schemas)
- Deterministic fallbacks (script nodes at ~100% reliability)
- Resumable workflows (checkpoint/resume)
- Human-in-the-loop (approval nodes with on_reject)
- Retry with exponential backoff and error classification
- Event-based observability

## Patterns to Implement Now

### 1. Inter-node Output Validation

When a node declares `output_format`, validate the actual output JSON against it before passing to downstream nodes. Prevents malformed data from propagating (the primary cascade failure mode).

### 2. Aggregated Metrics

`getWorkflowStats()` — success rate, average duration, most-failing nodes. Essential to identify which "nine" to attack next.

### 3. AI Runner Error Resilience

Return tool errors to the LLM as context instead of throwing. The model can often recover from a failed tool call by trying a different approach. (Thorsten Ball: "Return errors to the model as tool results, not exceptions.")

## Patterns for v2

### 4. Circuit Breaker

If a node fails N times in a row with the same transient error pattern, stop retrying and mark the run as "circuit open" instead of exhausting all retries.

### 5. Risk Tagging

Optional `risk: "low" | "medium" | "high"` on nodes. High-risk nodes auto-require approval gates or sandboxing.

### 6. Schema Validation Pipeline

Type-safe data flow between nodes — declare input expectations per node, validate at runtime that upstream outputs match downstream expectations.
