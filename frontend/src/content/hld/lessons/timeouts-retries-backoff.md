Every network call can hang or fail, so every call needs a timeout and a decision about retrying. Done well, retries hide brief blips; done badly, they multiply load on a struggling service and turn a small hiccup into a full outage.

## The analogy

If you call a shop and nobody answers, you hang up after a reasonable number of rings (timeout). You call again in a minute, then five, then fifteen (exponential backoff). If a whole town had the same idea at the same moment, the shop's phone would be jammed forever, so everyone waits a slightly random amount (jitter).

## Timeouts

Without a timeout, a slow dependency ties up your threads, connections, and memory indefinitely. By Little's law, if latency rises from 50 ms to 5 s, the number of in-flight requests rises 100x and you run out of resources.

- **Connect timeout**: short (100 ms–1 s); establishing a connection should be quick.
- **Request timeout**: based on the dependency's p99 or p99.9 plus margin, not on hope.
- **Deadlines propagate**: if the user-facing request has a 2 s budget and 1.5 s has passed, the downstream call should get at most 0.5 s. gRPC carries deadlines natively.

```text
Client budget 2000 ms
  API (spent 300) --> calls Order svc with deadline 1700
     Order (spent 400) --> calls Inventory with deadline 1300
        Inventory sees little time left -> fails fast instead of doing useless work
```

## When to retry

Retry only when the failure is likely **transient** and the operation is **safe to repeat**.

| Situation | Retry? |
|---|---|
| Connection refused / reset, 503, 504, timeouts | Yes, with backoff |
| 429 Too Many Requests | Yes, honouring `Retry-After` |
| 400, 401, 403, 404, 422 | No; it will fail again |
| Non-idempotent POST without idempotency key | No (or add a key first) |
| 500 | Maybe, depending on whether it is known to be transient |

## Exponential backoff with jitter

```text
delay = min(cap, base * 2^attempt)
full jitter:   sleep(random(0, delay))
equal jitter:  sleep(delay/2 + random(0, delay/2))
```

With base 100 ms and cap 10 s: attempts wait up to 100, 200, 400, 800 ms, and so on. Without jitter, clients that failed together retry together, creating synchronized waves. Full jitter spreads them across the interval and usually minimizes total work.

## Retry amplification

Retries at every layer multiply. If each of three layers retries 3 times, one user request can become 3 × 3 × 3 = 27 calls to the bottom service, precisely when it is already overloaded.

Defences:

- **Retry at one layer**, usually closest to the caller that knows the context, or the edge.
- **Retry budgets**: allow retries only up to, say, 10% of normal traffic per client; beyond that, fail fast.
- **Circuit breakers** to stop calling a dependency that is clearly down.
- **Limit attempts** (2–3 total) and respect overall deadlines.

## Hedged requests

For latency-critical reads, send a second request to another replica if the first has not answered by the p95 time, and use whichever returns first. This cuts tail latency at the cost of a few percent extra load. Only for idempotent reads.

## Common mistakes

- No timeout, or a default of 30–60 seconds inherited from a library.
- Retrying non-idempotent operations and creating duplicates.
- Retrying immediately without backoff or jitter.
- Retries at every layer, causing amplification storms.
- Timeouts longer downstream than upstream, so the caller gives up while the callee keeps working.

## In the interview

**Q: How do you choose a timeout for a dependency?**
Look at its latency distribution: set the timeout somewhat above its p99 (or p99.9) so normal slow requests succeed but pathological ones are cut off, and ensure it fits within the caller's overall deadline.

**Q: Why add jitter to backoff?**
Without it, clients that failed at the same time retry in lock-step, producing synchronized spikes that keep the service overloaded. Jitter spreads retries out so the service can recover.

**Q: Your service is overloaded and retries are making it worse. What do you do?**
Cap retries with a retry budget, open circuit breakers, shed load at the edge, and return 503 with `Retry-After` so clients back off.

## Key takeaways

- Every remote call needs a timeout tied to an end-to-end deadline.
- Retry only transient failures and only idempotent operations.
- Use exponential backoff with jitter and a small maximum number of attempts.
- Prevent amplification with single-layer retries, retry budgets, and circuit breakers.
