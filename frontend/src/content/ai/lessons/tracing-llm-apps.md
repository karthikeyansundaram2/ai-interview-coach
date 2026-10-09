When a user says "the bot gave me a wrong answer", you need to see exactly what happened: which prompt version, which chunks were retrieved, which tools were called with what arguments, and what the model returned at each step. Tracing makes LLM apps debuggable.

## The analogy

An aircraft's flight recorder logs every control input and instrument reading. After an incident, investigators don't guess — they replay the timeline. A trace is the flight recorder for one request through your AI system.

## Why traditional logging isn't enough

A single user request might trigger a query rewrite, two retrievals, a rerank, three LLM calls, and four tool calls — some in parallel, some in loops. Flat log lines can't show that structure, and LLM-specific data (prompts, token counts, model parameters) doesn't fit typical log schemas.

## Traces and spans

```text
 trace: POST /chat  (2.8s, $0.0041, user=u_123, prompt=v14)
 ├─ span: rewrite_query        llm small-fast   180ms   in 420 / out 35 tokens
 ├─ span: retrieve             hybrid           95ms    k=40, top_score=0.82
 │   ├─ span: bm25             22ms
 │   └─ span: vector_search    61ms
 ├─ span: rerank               cross-encoder    140ms   kept 6
 ├─ span: agent_step_1         llm large        900ms   tool_call=get_order
 │   └─ span: tool:get_order   45ms   status=ok
 ├─ span: agent_step_2         llm large        1.3s    finish=stop
 └─ span: output_guardrail     30ms   pass
```

Each **span** records start/end time, parent, attributes, and status. The **trace** ties them together under one request ID.

## What to capture on LLM spans

| Field | Why |
|---|---|
| Model name/version, parameters | Reproduce behavior; correlate regressions with model changes |
| Prompt template name + version | Know which prompt produced the output |
| Input/output messages (redacted) | Debugging, building eval cases |
| Token counts (input, cached, output) | Cost attribution, cache effectiveness |
| Latency, TTFT | Performance monitoring |
| Finish reason | Detect truncation, content filtering |
| Tool calls + arguments + results | Agent debugging |
| Retrieved doc IDs + scores | RAG debugging |
| User/tenant/session IDs | Slicing, support investigations |

Emerging OpenTelemetry semantic conventions for generative AI standardize many of these attribute names; following them keeps you portable across observability backends.

## Instrumenting with OpenTelemetry

```python
import time
from opentelemetry import trace

tracer = trace.get_tracer("support-bot")

def traced_llm_call(llm, *, model, messages, prompt_version, **params):
    with tracer.start_as_current_span("llm.chat") as span:
        span.set_attribute("gen_ai.request.model", model)
        span.set_attribute("app.prompt.version", prompt_version)
        span.set_attribute("app.input.preview", redact(messages[-1]["content"])[:500])
        t0 = time.perf_counter()
        try:
            resp = llm.complete(model=model, messages=messages, **params)
        except Exception as e:
            span.record_exception(e)
            span.set_status(trace.Status(trace.StatusCode.ERROR))
            raise
        span.set_attribute("gen_ai.usage.input_tokens", resp.usage.input_tokens)
        span.set_attribute("gen_ai.usage.output_tokens", resp.usage.output_tokens)
        span.set_attribute("app.cost_usd", estimate_cost(model, resp.usage))
        span.set_attribute("app.finish_reason", resp.finish_reason)
        span.set_attribute("app.latency_ms", (time.perf_counter() - t0) * 1000)
        return resp
```

Framework callbacks (e.g., in LangChain/LangGraph) and dedicated LLM observability platforms can capture most of this automatically; OpenTelemetry lets you send it to whatever backend you already run.

## Dashboards and alerts

- **Quality**: thumbs-down rate, escalation rate, guardrail block rate, sampled judge scores (faithfulness).
- **Performance**: p50/p95 latency and TTFT per route; tool error rates.
- **Cost**: tokens and dollars per request, per feature, per tenant; cache hit rate.
- **Reliability**: provider errors, rate-limit hits, fallback activations, truncations.

Alert on shifts, not just thresholds — a sudden rise in average output tokens or a drop in cache hits usually means a deploy changed something.

## Closing the loop

Traces are the raw material for improvement:

```text
 production traces ─► filter (thumbs-down, low judge score, escalations) ─► human review
        ▲                                                                       │
        └──────── deploy fix ◄── eval passes ◄── add to golden set ◄────────────┘
```

## Privacy

Prompts and outputs contain user data. Redact PII before export, restrict who can view raw content, set retention limits, and be careful about sending traces to third-party tools without appropriate agreements.

## Common mistakes

- Logging only the final answer, not intermediate retrievals and tool calls.
- No prompt version on traces, so regressions can't be attributed.
- Shipping raw PII to an observability vendor.
- Collecting traces but never reviewing them or feeding them into evals.

## In the interview

**Q: How would you debug a wrong answer reported by a user?**
Find the trace by request or session ID; check the rewritten query, retrieved chunks and scores, prompt version, tool calls, and model output at each step; identify whether retrieval or generation failed; add the case to the golden set; fix and verify with evals.

**Q: What do you log for each LLM call?**
Model and parameters, prompt version, redacted inputs/outputs, token counts including cached tokens, latency and TTFT, finish reason, tool calls, and correlation IDs for user and session.

**Q: How do you monitor quality in production without labels?**
Proxy signals (feedback, escalations, retries), guardrail rates, and LLM-judge scores on sampled traffic, with periodic human review to calibrate.

## Key takeaways

- Trace every step as nested spans under one request ID.
- Capture model, prompt version, tokens, latency, tool calls, retrieval results.
- Dashboard quality, performance, cost, and reliability; alert on shifts.
- Feed bad traces into the golden set; redact PII throughout.
