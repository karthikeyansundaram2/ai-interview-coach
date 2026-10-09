LLM calls are slow and priced per token, and production traffic is surprisingly repetitive. Caching — of whole responses, of similar questions, and of shared prompt prefixes — is often the single biggest cost and latency win available.

## The analogy

A busy help desk gets the same few questions all day. A smart agent keeps a binder of answers to frequent questions (response cache). They also recognize that "how do I reset my password" and "forgot password, help" are the same question (semantic cache). And they keep the reference manual open on the desk at the right chapter instead of fetching it from the archive for each call (prefix/prompt caching).

## Three layers of caching

```text
 request ──► [exact cache] ──hit──► response
                │ miss
                ▼
          [semantic cache] ──hit (similarity > τ)──► response
                │ miss
                ▼
          LLM provider ──► [prompt/prefix cache inside provider: reuse computed prefix]
```

| Layer | Key | Hit rate | Risk |
|---|---|---|---|
| Exact response cache | Hash of model + full prompt + params | Low–medium | Stale answers |
| Semantic cache | Embedding of normalized query | Higher | Wrong answer for a subtly different question |
| Provider prompt caching | Shared prompt prefix | Very high for long stable prefixes | Minimal — output still freshly generated |

## Exact caching

```python
import hashlib, json

def cache_key(model: str, messages: list[dict], params: dict, version: str) -> str:
    payload = json.dumps({"m": model, "msgs": messages, "p": params, "v": version},
                         sort_keys=True, ensure_ascii=False)
    return "llm:" + hashlib.sha256(payload.encode()).hexdigest()

async def cached_completion(redis, llm, model, messages, params, version, ttl=3600):
    key = cache_key(model, messages, params, version)
    if (hit := await redis.get(key)) is not None:
        return json.loads(hit), True
    result = await llm.complete(model=model, messages=messages, **params)
    if result.finish_reason == "stop":                  # don't cache truncated/error output
        await redis.set(key, json.dumps(result.to_dict()), ex=ttl)
    return result, False
```

Include the prompt/template version in the key so deploys invalidate old entries. Exact caching works best for deterministic workloads: classification, extraction, embeddings (always cache embeddings by content hash), and repeated batch jobs.

## Semantic caching

Embed the user query; if a previous query is within a similarity threshold, return its answer. It can deliver large hit rates on FAQ-style traffic, but it's risky:

- "Cancel my order" vs "Don't cancel my order" can embed closely.
- Answers that depend on user context (account, date, permissions) must not be shared across users.

Make it safe: only cache generic, non-personalized answers; scope by tenant; use a strict threshold tuned on labeled pairs; prefer caching the *retrieval result* rather than the final answer; and set TTLs aligned with content freshness.

## Provider prompt caching

Every request recomputes attention keys and values for the whole prompt. When many requests share a long prefix — a big system prompt, tool definitions, a long document, few-shot examples — providers can cache the computed prefix state and reuse it. At the time of writing, providers typically charge substantially less for cached input tokens and reduce time-to-first-token, sometimes automatically and sometimes via explicit cache markers, with a short cache lifetime that refreshes on use.

The rule that makes it work: **stable content first, variable content last.**

```text
 GOOD:  [system prompt][tool defs][few-shot examples][long document] | [history][user question]
         └──────────────── cacheable shared prefix ───────────────┘   └── varies per request ──┘

 BAD:   [today's timestamp][user name][system prompt]...   ← prefix changes every call, never hits
```

Practical tips:
- Don't put timestamps, request IDs, or user names at the top of the system prompt.
- Keep tool definitions in a deterministic order.
- For multi-turn chat, the growing conversation is itself a reusable prefix for the next turn.
- Monitor the cached-token count the API reports; a sudden drop means someone broke prefix stability.

Self-hosted inference servers offer the same idea (prefix caching of the KV cache across requests).

## Measuring impact

Track hit rate per layer, tokens saved, latency at p50/p95 for hits vs misses, and — for semantic caches — the error rate of cache hits via sampled review.

## Common mistakes

- Caching personalized answers in a shared cache — a privacy incident waiting to happen.
- Cache keys without model or prompt version, serving stale behavior after deploys.
- Dynamic content at the start of prompts, killing prefix-cache hits.
- Caching error or truncated responses.

## In the interview

**Q: How would you reduce LLM costs for a support bot with repetitive questions?**
Restructure prompts so the static prefix is cacheable by the provider; add an exact cache for repeated requests; consider a tenant-scoped semantic cache for generic FAQs with a tuned threshold; cache embeddings and retrieval results; measure hit rates and correctness.

**Q: What are the risks of semantic caching?**
Returning an answer to a similar-but-different question, and leaking personalized content across users. Mitigate with strict thresholds, scoping, non-personalized-only caching, and TTLs.

**Q: How does prompt caching work?**
The provider stores the computed attention state for a prompt prefix and reuses it for later requests with an identical prefix, cutting input cost and time-to-first-token. It requires stable content at the start of the prompt.

## Key takeaways

- Three layers: exact, semantic, and provider prefix caching.
- Put stable content first so prefix caching hits.
- Semantic caches need strict thresholds and must never share personalized answers.
- Version cache keys and measure hit rates and correctness.
