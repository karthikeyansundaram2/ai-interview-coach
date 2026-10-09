Rate limiting caps how many requests a client can make in a period, protecting your service from abuse, runaway clients, and cost overruns. The algorithm you pick decides how bursts are treated and how much state you store per client.

## The analogy

A theme-park ride lets in a fixed number of people per run. A token bucket is a ticket booth that prints one ticket per second and holds up to 10: you can show up with friends and use 10 at once, but then must wait for new tickets. A leaky bucket is a turnstile that lets exactly one person through per second no matter how big the crowd is.

## Where to apply limits

- Per user / API key, per IP, per endpoint, per tenant, and globally to protect a dependency.
- At the edge (CDN/WAF for abuse), at the API gateway (per-client quotas), and inside services (protecting a database).

## The algorithms

**Token bucket**: a bucket holds up to `capacity` tokens, refilled at `rate` per second. Each request takes a token; no token, reject.

```text
tokens = min(capacity, tokens + (now - last_refill) * rate)
if tokens >= 1: tokens -= 1; allow   else: reject (429)
```

Allows bursts up to capacity while enforcing a long-term average. Only two numbers per client. The most widely used algorithm (AWS API Gateway, Stripe).

**Leaky bucket**: requests enter a queue that drains at a fixed rate. Smooths output perfectly, good for protecting a downstream that needs steady load, but adds queueing delay and bursts are delayed rather than served.

**Fixed window counter**: count requests per window (`user:42:2026-10-09T10:15`). Simple and cheap, but allows double the limit at a boundary: 100 requests at 10:14:59 and 100 more at 10:15:00.

**Sliding window log**: store a timestamp for each request and count those in the last window. Exact, but memory grows with the limit (a 10k/hour limit stores up to 10k timestamps per client).

**Sliding window counter**: blend the current and previous fixed windows:

```text
estimate = current_count + previous_count * (1 - elapsed_fraction_of_current_window)
```

Nearly as accurate as the log with the memory of fixed windows.

## Comparison

| Algorithm | Memory per key | Bursts | Accuracy | Notes |
|---|---|---|---|---|
| Token bucket | 2 values | Allowed up to capacity | Good | Best general default |
| Leaky bucket | Queue | Smoothed | Good | Shapes traffic to a constant rate |
| Fixed window | 1 counter | 2x at boundaries | Approximate | Simplest |
| Sliding log | O(limit) | Exact | Exact | Expensive at high limits |
| Sliding counter | 2 counters | Mostly smooth | Very good | Great trade-off |

## Distributed rate limiting

With many API servers, counters must be shared or carefully split:

```text
Clients -> LB -> API servers ----> Redis (atomic Lua: refill + take token)
                          \--> local in-memory bucket (fast path, synced periodically)
```

- **Central store (Redis)**: run the read-modify-write atomically in a Lua script or use `INCR` with expiry for windows. Adds ~1 ms per request; Redis becomes critical, so decide whether to fail open or fail closed if it is down.
- **Local limits**: divide the global limit across N servers. No network call, but inaccurate when traffic is unevenly balanced.
- **Hybrid**: local buckets that periodically reconcile with a central store, trading slight overshoot for speed.
- **Sticky routing**: hash a client to one limiter node so its state is local.

## Communicating limits

Return `429 Too Many Requests` with `Retry-After`, and expose headers such as `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` so well-behaved clients slow down.

## Common mistakes

- Non-atomic read-then-write against Redis, letting concurrent requests slip through.
- Rate limiting only by IP, which punishes users behind carrier-grade NAT and misses distributed attackers.
- Failing closed when the limiter store is down, turning a cache outage into a full outage.
- Forgetting to limit expensive internal endpoints, not only public ones.

## In the interview

**Q: Which algorithm would you choose for a public API?**
Token bucket per API key: it permits reasonable bursts, enforces a sustained rate, and needs only two values per key in Redis.

**Q: How do you avoid the fixed-window boundary problem?**
Use a sliding window counter that weights the previous window by how much of it still overlaps, or a token bucket.

**Q: If Redis is unavailable, what happens?**
Usually fail open with a conservative local per-instance limit so legitimate traffic keeps flowing, and alert. For security-critical limits like login attempts, failing closed may be correct.

## Key takeaways

- Token bucket is the general default; sliding window counter is a strong alternative.
- Fixed windows are cheap but let through 2x at boundaries.
- Distributed limits need atomic operations in a shared store or approximate local splits.
- Decide fail-open versus fail-closed deliberately and return helpful 429 responses.
