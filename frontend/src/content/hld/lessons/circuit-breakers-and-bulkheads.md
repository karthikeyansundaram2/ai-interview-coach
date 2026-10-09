When a dependency is failing, the worst thing you can do is keep waiting on it. Circuit breakers stop calls to a sick dependency so you fail fast, and bulkheads partition your resources so one bad dependency cannot consume everything.

## The analogy

A household circuit breaker trips when a faulty appliance draws too much current, cutting power to that circuit before the wiring catches fire; after a while you try switching it back on. A ship's bulkheads divide the hull into watertight compartments so one breach floods only one section instead of sinking the ship.

## Circuit breaker states

```text
          failures exceed threshold
 CLOSED ------------------------------> OPEN
   ^  (calls flow, failures counted)      | (calls fail immediately)
   |                                      | after cool-down (e.g. 30 s)
   |   trial calls succeed                v
   +------------------------------- HALF-OPEN
           trial calls fail -> back to OPEN
```

- **Closed**: requests flow normally; the breaker tracks failure rate (errors and timeouts) over a rolling window.
- **Open**: when failures exceed a threshold (for example 50% of at least 20 calls in 10 seconds), calls fail immediately without touching the dependency.
- **Half-open**: after a cool-down, a few trial requests are allowed. Success closes the circuit; failure reopens it.

Benefits:

- Callers get an instant failure instead of waiting for a timeout, freeing threads.
- The struggling dependency gets breathing room to recover.
- You can serve a **fallback**: cached data, a default value, a degraded feature, or a clear error.

## Fallback examples

| Dependency down | Fallback |
|---|---|
| Recommendation service | Show popular items |
| Personalization for a feed | Non-personalized trending feed |
| Price service | Last cached price with "may have changed" note, or block checkout |
| Reviews service | Hide the reviews widget |
| Payment provider A | Route to provider B |

Not every dependency has a safe fallback: for payments or inventory, failing clearly is better than guessing.

## Bulkheads

Bulkheads isolate resources so that exhaustion in one area does not spread.

- **Separate thread or connection pools per dependency**: if the reviews service hangs, only the 20 threads allotted to it block; checkout threads are untouched.
- **Separate instances or clusters per workload**: run batch exports on different nodes from interactive APIs.
- **Per-tenant isolation**: a noisy customer gets its own queue or shard.
- **Cell-based architecture**: split the whole stack into independent cells, each serving a subset of users, so an outage affects only one cell.

```text
Service process
 +--------------------------------------------------+
 | Pool A (checkout -> payment)   [|||||||||||] 50   |
 | Pool B (product -> reviews)    [XXXXXXXXXXX] 20   |  <- all stuck, but isolated
 | Pool C (search -> index)       [|||||     ] 30    |
 +--------------------------------------------------+
```

## Related protections

- **Load shedding**: when saturated, reject low-priority work early (with 503) to keep serving high-priority work.
- **Admission control / concurrency limits**: cap in-flight requests; adaptive limiters (like TCP congestion control) adjust the cap from observed latency.
- **Graceful degradation**: design features as optional where possible.

## Tuning

- Thresholds too sensitive cause flapping; too lax and the breaker never helps. Use a minimum request volume before evaluating.
- Count timeouts as failures; they are the most harmful kind.
- Emit metrics on state changes so engineers see when breakers open.
- In a service mesh, outlier detection plays a similar role per backend instance.

## Common mistakes

- Circuit breakers without fallbacks or clear errors, just a different exception.
- A single shared thread pool for all outbound calls.
- Treating 4xx client errors as failures that trip the breaker.
- Fallbacks that call another fragile dependency.

## In the interview

**Q: The recommendation service is timing out and your product page is slow. What do you do?**
Add a tight timeout and a circuit breaker around it. When open, render the page with a popular-items fallback, and isolate those calls in their own pool so product page threads are not exhausted.

**Q: What is the difference between a circuit breaker and a retry?**
Retries assume a failure is transient and try again; circuit breakers assume repeated failures mean the dependency is unhealthy and stop calling it. They complement each other: retry a little, and break when failures persist.

**Q: What is a cell-based architecture?**
Partitioning the system into independent copies (cells), each serving a slice of customers with its own resources, so a bad deploy or overload affects only that slice.

## Key takeaways

- Circuit breakers fail fast and give dependencies time to recover.
- Pair breakers with meaningful fallbacks or clear errors.
- Bulkheads limit the blast radius by isolating pools, workloads, tenants, or cells.
- Combine with timeouts, retry budgets, and load shedding for defence in depth.
