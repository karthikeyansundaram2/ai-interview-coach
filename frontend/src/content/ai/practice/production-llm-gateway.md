Build the service that sits between every application in a company and every LLM provider: one API that routes, caches, rate-limits, retries, falls back, and traces each request. It's a backend engineer's home turf applied to AI — and a strong interview story.

## What you'll build

An async Python gateway (FastAPI + Redis + Postgres) exposing an OpenAI-style `/v1/chat/completions` and `/v1/embeddings` interface. Features:

- **Provider adapters** for two or more providers (plus a local model via an OpenAI-compatible server), normalizing requests, responses, streaming, and usage.
- **Routing**: by model alias (`fast`, `smart`, `cheap-embed`), by team policy, and via a cascade (cheap first, escalate on validation failure).
- **Caching**: exact response cache for deterministic requests; embedding cache by content hash; preserve provider prompt-cache friendliness.
- **Rate limiting and quotas**: per API key, per team — requests/min and tokens/day — with token-bucket semantics in Redis.
- **Resilience**: timeouts, retries with jittered backoff on retryable errors, circuit breakers per provider, fallback chains.
- **Streaming** pass-through with cancellation on client disconnect.
- **Observability**: OpenTelemetry traces, cost accounting per key/team/model, Prometheus metrics, redacted request logs.
- **Admin**: API key management, budgets, and a usage report endpoint.

## Architecture

```text
 apps ──HTTPS──► ┌───────────────────────── gateway (FastAPI, async) ─────────────────────────┐
                 │ auth (API key → team, policy) ─► quota check (Redis token buckets)          │
                 │        │                                                                     │
                 │        ▼                                                                     │
                 │ request normalizer ─► cache lookup (Redis) ──hit──► response                 │
                 │        │ miss                                                                │
                 │        ▼                                                                     │
                 │ router: alias → [primary, fallback...]; cascade rules                        │
                 │        │                                                                     │
                 │        ▼                                                                     │
                 │ provider adapter ─► circuit breaker ─► retry/backoff ─► upstream provider    │
                 │        │ (stream or full)                                                    │
                 │        ▼                                                                     │
                 │ usage + cost calc ─► cache store ─► response / SSE stream                    │
                 └──────────┬──────────────────────────────────────────────────────────────────┘
                            ▼
          traces (OTel) · metrics (Prometheus) · usage ledger (Postgres) · redacted logs
```

## Milestones

1. **Unified API + one provider.** Normalize the request/response schema; implement non-streaming and streaming.
   *Acceptance:* an existing OpenAI-style client works against the gateway by changing only the base URL; streaming output is identical in content to direct calls.

2. **Second provider + routing.** Model aliases mapped to provider/model pairs in config; per-team allowed models.
   *Acceptance:* switching `smart` from provider A to B is a config change; a team without access to `smart` gets a 403 with a clear message.

3. **Rate limits and quotas.** Atomic Redis token buckets for requests/min and tokens/day; return standard rate-limit headers.
   *Acceptance:* a load test at 2× a key's limit gets 429s for the excess with no over-admission; token quotas are enforced using actual usage after responses.

4. **Resilience.** Timeouts, retries with jitter for 429/5xx, per-provider circuit breaker, fallback chain.
   *Acceptance:* with provider A forced to fail, requests succeed via B within the latency budget; the breaker opens and later half-opens; no retries on non-retryable 4xx.

5. **Caching.** Exact cache for `temperature == 0` requests keyed by normalized payload + model version; embedding cache by text hash; TTLs and opt-out header.
   *Acceptance:* repeat requests hit the cache with large latency reduction; responses with `finish_reason != stop` are never cached.

6. **Observability and cost.** OTel spans per request and upstream attempt; per-key/team/model cost ledger; Prometheus metrics for latency (TTFT and total), errors, cache hits, tokens.
   *Acceptance:* a usage endpoint returns cost by team for a date range; a dashboard shows p95 latency per provider and cache hit rate.

## Key code

```python
import asyncio, random, time
from dataclasses import dataclass

RETRYABLE = {408, 429, 500, 502, 503, 504}

@dataclass
class Route:
    provider: str
    model: str

class CircuitBreaker:
    def __init__(self, failures=5, reset_after=30.0):
        self.failures, self.reset_after = failures, reset_after
        self.count, self.opened_at = 0, None

    def allow(self) -> bool:
        if self.opened_at is None:
            return True
        return time.monotonic() - self.opened_at > self.reset_after   # half-open probe

    def record(self, ok: bool):
        if ok:
            self.count, self.opened_at = 0, None
        else:
            self.count += 1
            if self.count >= self.failures:
                self.opened_at = time.monotonic()

class Gateway:
    def __init__(self, adapters, routes: dict[str, list[Route]], cache, limiter, ledger, tracer):
        self.adapters, self.routes = adapters, routes
        self.cache, self.limiter, self.ledger, self.tracer = cache, limiter, ledger, tracer
        self.breakers = {p: CircuitBreaker() for p in adapters}

    async def complete(self, key, req: dict) -> dict:
        await self.limiter.check(key, est_tokens=estimate_tokens(req))      # raises 429
        cacheable = req.get("temperature", 1) == 0 and not req.get("stream")
        if cacheable and (hit := await self.cache.get(req)):
            return hit | {"x_cache": "hit"}

        errors = []
        for route in self.routes[req["model"]]:                            # fallback chain
            if not self.breakers[route.provider].allow():
                errors.append(f"{route.provider}: circuit open"); continue
            for attempt in range(3):
                with self.tracer.start_as_current_span("upstream") as span:
                    span.set_attribute("provider", route.provider)
                    try:
                        resp = await asyncio.wait_for(
                            self.adapters[route.provider].chat(route.model, req), timeout=60)
                        self.breakers[route.provider].record(True)
                        await self.ledger.record(key, route, resp["usage"])
                        await self.limiter.commit(key, resp["usage"]["total_tokens"])
                        if cacheable and resp["choices"][0]["finish_reason"] == "stop":
                            await self.cache.set(req, resp)
                        return resp
                    except UpstreamError as e:
                        self.breakers[route.provider].record(False)
                        errors.append(f"{route.provider}: {e.status}")
                        if e.status not in RETRYABLE:
                            break
                        await asyncio.sleep(min(8, 2 ** attempt) * random.uniform(0.5, 1.0))
                    except asyncio.TimeoutError:
                        self.breakers[route.provider].record(False)
                        errors.append(f"{route.provider}: timeout")
        raise AllRoutesFailed(errors)
```

## Stretch goals

- Semantic cache scoped per team, with a tuned threshold and sampled correctness review.
- Cascade routing with a learned difficulty classifier and cost/quality reporting.
- PII redaction middleware with per-team policies.
- Batch API endpoint that queues offline jobs to provider batch APIs.
- Multi-region deployment with sticky routing for prompt-cache locality.

## What to say about it in interviews

- **Why a gateway**: central control of keys, spend, policy, and observability; vendor independence via config-level routing.
- **Distributed systems depth**: atomic token buckets in Redis, circuit breakers, jittered retries, idempotency, backpressure — your existing strengths, applied to AI.
- **LLM-specific twists**: token-based quotas reconciled after the response, streaming pass-through with cancellation, never caching truncated outputs, and keeping prompts prefix-cache friendly.
- **Measured results**: cache hit rate, p95 latency under failover, cost per team — numbers from your load tests.
- **Trade-offs**: added hop latency vs control; exact vs semantic caching risks; fail-open vs fail-closed on quota service outages.
