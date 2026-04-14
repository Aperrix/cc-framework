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

### 7. Code Mode Execution (`execution: "code"`)

> Source: Cloudflare Code Mode (Rita Kozlov, Kenton Varda), Anthropic Programmatic Tool Calling (PTC)

Instead of the agent loop (many tool call round-trips), LLM generates a complete script that handles iteration internally. Executed in a sandbox via the script runner.

**Why:** LLMs are vastly better at code generation than tool calling. Code is a native capability (trained on all of GitHub), tool calling is fine-tuned behavior. The reliability and token impact is dramatic:

- 30 tool calls at 98% = 54% end-to-end. 1 code gen + 1 execution = 96%.
- Token savings: 32-81% depending on task complexity (Cloudflare benchmarks).

**How:** New `execution: "code"` field on prompt nodes. The framework:

1. Reads available tools and converts them to TypeScript/Python function signatures
2. Asks the LLM to generate a complete script (not tool calls)
3. Executes via the script runner (bash/bun/uv)
4. Captures the result

```yaml
- id: batch-create
  prompt: "Create events for every day in January 2026"
  execution: code
  runtime: bun
```

**Interim:** The existing DAG already supports a manual Code Mode pattern:

```yaml
- id: generate
  prompt: "Generate a script that does X. Output ONLY executable code."
- id: execute
  script: $generate.output
  runtime: bun
  depends_on: [generate]
```

**Related:** Anthropic's PTC (`allowed_callers: ["code_execution_20260120"]`) achieves similar results at the API level. Could be enabled per-node via a flag in the AI runner.

### 8. Anthropic PTC Integration

Enable Programmatic Tool Calling on AI nodes that declare many tools or are expected to make batch operations. Pass `allowed_callers: ["code_execution_20260120"]` on tool definitions so Claude generates code that calls tools from within the code execution container, eliminating per-call round trips.
