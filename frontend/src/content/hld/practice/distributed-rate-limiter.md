A distributed rate limiter enforces rules like "100 requests per minute per API key" across a fleet of servers, so a client can't exceed its quota by spreading requests across instances. The challenge is making the shared counter fast, atomic, and resilient, since it sits in front of every request.

## Clarify requirements

**Functional**
- Limit requests per client identity (API key, user ID, IP) and optionally per endpoint.
- Rules are configurable: e.g. 1,000 req/min per key, 10 login attempts/hour per IP, tenant-level tiers.
- On limit, reject with 429 and `Retry-After`; return remaining quota headers.
- Support bursts where configured.

**Non-functional**
- 1M requests/s across the fleet at peak.
- Added latency < 2 ms p99.
- Accuracy: small overshoot (a few percent) is acceptable for most rules; security rules (login) should be strict.
- Highly available: the limiter failing must not take down the API.

## Back-of-the-envelope

- 1M checks/s; if every check hits a central store, that's 1M ops/s. A Redis node handles ~100k–200k simple ops/s, and Lua scripts are a bit costlier, so plan for **10–20 Redis shards**.
- Active keys: 10M clients × ~2 values (tokens, timestamp) × ~100 B = **~1 GB** of state. Memory is not the issue; throughput is.
- Network: 1M × ~200 B round trip ≈ 200 MB/s across the Redis fleet; fine when spread over shards.
- Latency budget: one in-datacenter Redis round trip ≈ 0.3–1 ms.

## API

Internal interface used by the gateway or middleware:

```text
check(key: "apikey:abc:/v1/orders", cost: 1) ->
   { allowed: bool, remaining: int, resetAt: ts, retryAfterMs: int }
```

Rule management:

```text
PUT /v1/ratelimit/rules/{ruleId}
  { "match": { "endpoint": "/v1/orders", "tier": "free" },
    "algorithm": "token_bucket", "capacity": 100, "refillPerSec": 1.67, "failMode": "open" }
```

Response headers to clients: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` on 429.

## Data model

```text
Rules (config store, cached in every gateway, refreshed on change):
  rule_id, match criteria, algorithm, capacity, refill rate, window, fail_mode

Counter state (Redis, sharded by key hash):
  Token bucket:  rl:{key} -> hash { tokens: float, ts: ms }   EXPIRE = time to full refill
  Sliding window counter: rl:{key}:{window_start} -> int      EXPIRE = 2 windows
```

## High-level design

```text
 Clients --> L7 LB --> API Gateway fleet (rate-limit middleware)
                           |   1. match rules (local cache)
                           |   2. local fast-path bucket (optional)
                           |   3. EVALSHA token_bucket.lua on Redis shard(hash(key))
                           v
                   Redis Cluster (primary + replica per shard)
                           |
                     allowed -> forward to backend services
                     denied  -> 429 + Retry-After

 Rules service --> config store --> pushed/polled by gateways
 Metrics: allowed/denied per rule, Redis latency, fail-open events
```

The limiter lives in the gateway or as a sidecar so services don't each reimplement it. Rules are cached locally; only counters require the network.

## Deep dives

### 1. Algorithm choice

| Algorithm | Fit here |
|---|---|
| Token bucket | Default: allows bursts up to capacity, two values per key, one atomic script |
| Sliding window counter | Good for "N per window" semantics without boundary spikes |
| Fixed window | Cheapest (`INCR` + `EXPIRE`) but allows 2x at window edges |
| Sliding log | Exact but O(N) memory per key; only for small limits like logins |

Token bucket as a Lua script (atomic on the Redis shard):

```text
local tokens, ts = HMGET(key, "tokens", "ts")
tokens = min(capacity, tokens + (now - ts) * rate)
if tokens >= cost then tokens -= cost; allowed = 1 else allowed = 0 end
HMSET(key, "tokens", tokens, "ts", now); PEXPIRE(key, ttl)
return {allowed, tokens}
```

Use the Redis server's time (or pass the gateway's time consistently) to avoid clock skew between gateways.

### 2. Atomicity and race conditions

A naive `GET` then `SET` from two gateways lets both read 1 remaining token and both allow. Lua scripts (or `MULTI` with `WATCH`) execute atomically on the shard. Keeping all state for one key on one shard (hash tags in Redis Cluster) keeps the script single-shard.

### 3. Latency and throughput: local + global hybrid

A Redis call per request may be too costly at 1M/s or for latency-sensitive paths. Options:

- **Local token buckets** sized at limit / N gateways: zero network cost, but inaccurate when traffic is uneven across gateways.
- **Batch/lease tokens**: each gateway leases a chunk of tokens (e.g. 10% of the limit) from Redis and serves from memory until exhausted, then leases more. Overshoot is bounded by outstanding leases.
- **Async sync**: count locally and push deltas every 100 ms; reject when the last known global count exceeds the limit. Slight overshoot during bursts.
- **Sticky routing**: consistent-hash the client key to a specific gateway so its limiter is local and exact; uneven load from heavy clients is the cost.

Choose per rule: strict security rules use the central Redis path; high-volume quota rules use leases.

### 4. Failure handling

If a Redis shard is down or slow (timeout ~5 ms):

- **Fail open** for general API quotas: allow the request, fall back to a conservative local bucket, emit a metric and alert.
- **Fail closed** for abuse-sensitive rules (login, OTP sending), where letting traffic through is worse than rejecting it.
- Wrap Redis calls in a circuit breaker so a dead shard doesn't add a timeout to every request.
- Replicas with automatic failover lose at most a few counter updates, which is acceptable.

## Bottlenecks & scaling

- **Redis throughput**: shard by key; add shards as QPS grows. Hot keys (one huge tenant) can be split into sub-keys with the limit divided, or served by leases.
- **Multi-region**: keep limits per region (simplest) or split global limits across regions by expected share and rebalance periodically; cross-region synchronous counters add too much latency.
- **Rule evaluation**: precompile rules into a lookup table so matching is O(1) per request.
- **DDoS**: volumetric attacks should be stopped at the edge/WAF before reaching this limiter; this one protects business quotas.

## Follow-ups the interviewer may ask

- **How do you rate-limit by multiple dimensions (user and IP and endpoint)?** Evaluate each matching rule; a request must pass all. Batch the checks into one Lua call per shard where possible.
- **How do clients learn to back off?** 429 with `Retry-After` and quota headers; SDKs implement exponential backoff with jitter.
- **How do you change limits without restarts?** Rules live in a config store; gateways subscribe to changes and swap rule tables atomically.
- **What about costs per request (expensive endpoints)?** Use a `cost` parameter: a report export might take 10 tokens.
- **How accurate is the lease approach?** Overshoot is bounded by the total leased-but-unused tokens across gateways; keep lease sizes small relative to the limit.
