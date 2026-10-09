AI system design interviews look like regular system design but grade different things: whether you scope the AI part sensibly, design for evaluation from day one, and handle the ways LLMs fail. A repeatable framework keeps you from spending 40 minutes on the vector database.

## The analogy

An experienced architect meeting a client doesn't start by sketching beams. They ask who will live there, the budget, the site, the must-haves. Then a floor plan, then structure, then materials, then inspections. The same order — requirements, shape, components, quality, operations — works for AI systems.

## The framework (45–60 minutes)

```text
 1. Clarify (5–8 min)     users, tasks, scale, latency, data, risk, success metrics
 2. Baseline (3–5 min)    simplest thing that could work; is an LLM even needed?
 3. Architecture (10 min) high-level diagram: online path + offline pipelines
 4. Deep dives (15 min)   retrieval, prompting, tools/agents, model choice
 5. Evaluation (5–8 min)  offline evals, online metrics, feedback loop
 6. Production (5–8 min)  safety, cost, latency, observability, failure modes
 7. Wrap-up (2 min)       trade-offs, what you'd build first, future work
```

### 1. Clarify requirements

Questions worth asking:
- **Users and tasks**: who uses it, for what? Internal agents or end customers?
- **Inputs and outputs**: chat? documents? actions in other systems?
- **Data**: what sources, how much, how fresh, who can see what?
- **Scale**: requests per day, peak QPS, corpus size.
- **Latency**: interactive (seconds) or batch (hours)?
- **Risk**: what happens if it's wrong? Money, health, legal, reputation?
- **Success metrics**: deflection rate, time saved, accuracy, CSAT?

Write the answers down as explicit assumptions.

### 2. Baseline first

State the simplest viable version: maybe a prompt over a small FAQ, or a classifier plus templates. It shows judgment and gives you a fallback. Then justify each added component.

### 3. Architecture

Separate the **online request path** from **offline pipelines** (ingestion, indexing, evaluation, fine-tuning).

```text
 ONLINE:  client ─► API/gateway ─► orchestrator ─► [guardrails] ─► retrieval ─► LLM ─► [guardrails] ─► client
                                       │                 ▲                        │
                                       └── tools/APIs ───┘          traces/feedback ─► store
 OFFLINE: sources ─► ingestion ─► chunk/embed ─► indexes        golden sets ─► eval runs ─► CI gate
```

### 4. Deep dives

Pick the two or three components that matter most for *this* problem and go deep: chunking and hybrid retrieval for search; tool design and approval flows for agents; routing and caching for high-volume cost-sensitive apps. Discuss alternatives and why you chose one.

### 5. Evaluation

Many candidates skip this; strong ones lead with it. Cover the golden set (how built, what slices), graders (programmatic, LLM-judge calibrated against humans), component metrics (retrieval recall, faithfulness), online metrics, and how failures feed back.

### 6. Production concerns

| Area | Talking points |
|---|---|
| Safety | Prompt injection, PII, permissions at retrieval, action approval |
| Cost | Token budget per request, routing, caching, batch for offline |
| Latency | Streaming, parallel steps, TTFT, p95 targets |
| Reliability | Provider fallback, timeouts, retries with idempotency, degraded modes |
| Observability | Traces per request, prompt versions, cost dashboards |

### Back-of-envelope cost

```python
def monthly_llm_cost(req_per_day, in_tokens, out_tokens, price_in_per_m, price_out_per_m,
                     cache_hit_ratio=0.0, cached_discount=0.9):
    effective_in = in_tokens * (1 - cache_hit_ratio * cached_discount)
    per_req = (effective_in * price_in_per_m + out_tokens * price_out_per_m) / 1e6
    return per_req * req_per_day * 30

# 50k requests/day, 3k input tokens (RAG context), 300 output tokens,
# illustrative prices; plug in real numbers at design time
print(round(monthly_llm_cost(50_000, 3_000, 300, 1.0, 4.0, cache_hit_ratio=0.5)))
```

Use illustrative prices and say so — the point is showing the drivers (input context size, output length, cache hit rate, model choice).

## Signals interviewers look for

- Asking about risk and success metrics before designing.
- Justifying LLM use instead of assuming it.
- Treating evaluation as a core component.
- Naming failure modes (hallucination, injection, stale data, cost blowups) and mitigations.
- Clear trade-offs, not a parade of buzzwords.

## Common mistakes

- Jumping straight to "we'll use a vector DB and an agent".
- No evaluation plan.
- Ignoring permissions on retrieved data.
- One giant LLM call doing classification, retrieval decisions, and answering.
- Forgetting the human handoff path.

## In the interview

**Q: How do you start an AI system design question?**
Clarify users, tasks, data, scale, latency, risk, and success metrics; propose a simple baseline; then build up the architecture, justifying each component.

**Q: Where does evaluation fit?**
It's a first-class component: golden sets, component and end-to-end metrics, calibrated judges, online signals, and a CI gate — designed alongside the architecture, not after.

**Q: How do you estimate LLM cost?**
Requests × (input tokens × input price + output tokens × output price), adjusted for cache hits and routing mix, then compare against the business value per request.

## Key takeaways

- Clarify → baseline → architecture → deep dives → evals → production → trade-offs.
- Separate online paths from offline pipelines.
- Lead with evaluation and risk; they differentiate senior candidates.
- Do back-of-envelope cost math with clearly labeled assumptions.
