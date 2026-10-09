Beyond caching, three levers dominate LLM cost and latency: streaming tokens as they're generated, batching work that isn't urgent, and routing each request to the cheapest model that can handle it well.

## The analogy

A restaurant can bring out dishes as they're ready instead of waiting for the whole order (streaming). It can bake bread in big overnight batches instead of one loaf per customer (batching). And it doesn't send the head chef to make toast — simple orders go to a junior cook, complex ones to the expert (routing).

## Latency anatomy

```text
 request ─► network ─► queue ─► prefill (read prompt) ─► decode tok1 tok2 tok3 ... tokN ─► done
                                └──── time to first token (TTFT) ────┘└─ inter-token latency ─┘
 total latency ≈ TTFT + N × time-per-output-token
```

- **TTFT** grows with prompt length (and shrinks with prompt caching).
- **Decode time** grows with output length — usually the bigger term. Asking for shorter outputs is often the cheapest speedup.

## Streaming

Streaming doesn't make generation faster; it makes the wait *feel* shorter, because users start reading after TTFT instead of after the full response.

```python
import asyncio, json
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

@app.post("/chat")
async def chat(req: dict):
    async def events():
        try:
            async for chunk in llm.stream(messages=req["messages"], max_tokens=800):
                if chunk.text:
                    yield f"data: {json.dumps({'delta': chunk.text})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except asyncio.CancelledError:      # client disconnected: stop paying for tokens
            await llm.cancel()
            raise
    return StreamingResponse(events(), media_type="text/event-stream")
```

Streaming considerations:
- **Output guardrails** must work incrementally (check sentence by sentence) or buffer a little.
- **Structured output** needs a tolerant partial-JSON parser for live rendering.
- **Cancellation**: stop generation when the client disconnects.
- **Tool calls** stream as argument fragments; assemble before executing.

## Batching

Two different meanings:

1. **Provider batch APIs**: submit thousands of requests as a job, get results within hours, typically at a significant discount. Ideal for offline work — eval runs, backfills, embedding a corpus, nightly classification, synthetic data generation.
2. **Request batching in your own code**: group embeddings or classification calls into one request (most embedding APIs accept lists), and use bounded concurrency for parallel calls.

```python
sem = asyncio.Semaphore(16)                      # respect provider rate limits

async def classify_one(text):
    async with sem:
        return await llm.complete(model="small", messages=[...], max_tokens=5)

results = await asyncio.gather(*(classify_one(t) for t in texts))
```

(Inside inference servers, *continuous batching* is a third meaning — covered in the serving module.)

## Model routing

Model prices and speeds differ by an order of magnitude or more between small and frontier models. Most traffic doesn't need the biggest one.

| Strategy | How | Trade-off |
|---|---|---|
| Static by task | Classification → small; complex reasoning → large | Simple, predictable |
| Classifier router | A cheap model or trained classifier predicts difficulty | Needs labeled data |
| Cascade | Try small model; escalate if confidence/validation fails | Extra latency on escalations |
| Fallback | On error/timeout/rate limit, switch provider or model | Resilience |

```python
async def answer(query, ctx):
    tier = await router.predict(query)            # "simple" | "complex"
    model = "small-fast" if tier == "simple" else "large-capable"
    resp = await llm.complete(model=model, messages=build(query, ctx))
    if model == "small-fast" and not passes_checks(resp):   # schema, grounding, confidence
        resp = await llm.complete(model="large-capable", messages=build(query, ctx))
    return resp
```

Evaluate routing on your golden set: quality per route, escalation rate, and blended cost per request. A router that sends 70% of traffic to a small model with no quality loss can cut cost dramatically.

## Other quick wins

- Cap `max_tokens` and ask for concise formats.
- Trim prompts: fewer retrieved chunks after reranking, shorter histories.
- Run independent calls in parallel (retrieval + guardrail check + query rewrite).
- Use smaller models for sub-steps (rewriting, routing, judging simple criteria).

## Common mistakes

- Using the largest model for everything "to be safe".
- Unbounded concurrency that triggers rate limits and retry storms.
- Streaming without output moderation or disconnect handling.
- Measuring average latency only; users feel the p95.

## In the interview

**Q: How do you reduce latency in an LLM app?**
Stream for perceived latency; reduce output length; cut prompt tokens and use prompt caching to lower TTFT; parallelize independent steps; route simple requests to faster models; and measure TTFT and p95 end-to-end.

**Q: What's a model cascade?**
Try a cheap model first and escalate to a stronger one only when validation or confidence checks fail. It reduces average cost while protecting quality on hard cases.

**Q: When would you use a batch API?**
For non-interactive workloads that tolerate hours of delay — evals, backfills, bulk classification, embeddings — to get lower prices and avoid competing with interactive traffic for rate limits.

## Key takeaways

- Latency = TTFT + output tokens × per-token time; output length matters most.
- Streaming improves perceived latency; handle guardrails and cancellation.
- Batch offline work; bound concurrency online.
- Route to the cheapest adequate model; evaluate the router itself.
