Latency is how long one request takes; throughput is how many requests you finish per second. Little's law ties them to concurrency, and it is the quickest way to size thread pools, connection pools, and fleets in an interview.

## The analogy

Picture a coffee shop. Latency is how long you wait from ordering to getting your cup. Throughput is how many cups the shop hands out per minute. If the shop serves 2 customers per minute and each customer spends 5 minutes inside, there are on average 10 people in the shop. That last sentence is Little's law.

## Latency

Latency is a distribution, not a number. Averages hide the slow tail that real users feel.

- **p50**: the median request.
- **p99**: 1 in 100 requests is slower than this.
- **p99.9**: the tail that often belongs to your heaviest, most valuable users.

Tail latency compounds with fan-out. If a page calls 100 backends in parallel and each has a 1% chance of being slow, then 1 - 0.99^100 ≈ **63%** of page loads hit at least one slow call. That is why large services obsess over p99 and use techniques like hedged requests (send a duplicate after the p95 time and take whichever answers first).

## Throughput

Throughput is measured in requests/s, messages/s, or bytes/s. It is limited by the bottleneck resource: CPU, disk IOPS, network, locks, or a downstream dependency.

## Little's law

```text
L = λ × W

L = average number of requests in the system (concurrency)
λ = arrival rate (throughput, requests per second)
W = average time each request spends in the system (latency)
```

It holds for any stable system regardless of distribution, which makes it unusually practical.

**Sizing a connection pool**: a service does 2,000 queries/s and each holds a DB connection for 5 ms. L = 2,000 × 0.005 = **10 connections** in use on average. Provision maybe 2–3x for bursts.

**Sizing a fleet**: 20k req/s, each takes 200 ms, so 4,000 requests are in flight. If one server handles 200 concurrent requests comfortably, you need about 20 servers, plus headroom.

**Spotting trouble**: if a downstream slows from 50 ms to 500 ms while traffic is constant, concurrency rises 10x. Threads, sockets, and memory fill up, and the slow dependency takes your service down with it.

## Utilization and queueing

As utilization approaches 100%, queueing delay explodes. For a simple single-server queue, waiting time grows roughly with ρ / (1 − ρ):

| Utilization ρ | Relative wait |
|---|---|
| 50% | 1x |
| 80% | 4x |
| 90% | 9x |
| 95% | 19x |

This is why systems are typically run at 50–70% of capacity: the headroom absorbs bursts without latency falling off a cliff.

## Latency vs throughput trade-offs

| Technique | Throughput | Latency |
|---|---|---|
| Batching (DB writes, Kafka producer) | Up | Up per item |
| Larger thread pools | Up until contention | Can rise from context switching |
| Caching | Up | Down |
| Compression | Up (less bandwidth) | Small CPU cost |
| Async/queue-based processing | Up, smooths peaks | Up for end-to-end completion |

## Common mistakes

- Reporting average latency as the SLO instead of percentiles.
- Averaging percentiles across hosts (you must merge histograms instead).
- Running systems hot at 90% utilization and being surprised by latency spikes.
- Ignoring that a slow dependency increases concurrency and can exhaust pools.

## In the interview

**Q: How many worker threads does a service need for 5k req/s at 40 ms each?**
By Little's law, 5,000 × 0.04 = 200 concurrent requests. With blocking I/O you need roughly 200 threads across the fleet, plus headroom; with async I/O you need far fewer threads but the same number of in-flight requests.

**Q: Why does p99 matter more than average?**
Users and upstream callers experience the tail, and fan-out multiplies the chance of hitting it. A good average can hide a terrible experience for a meaningful fraction of requests.

**Q: Why not run servers at 95% CPU to save money?**
Queueing delay grows sharply near saturation, so small bursts cause large latency spikes and timeouts, which then trigger retries and make it worse.

## Key takeaways

- Measure latency as percentiles; tails compound with fan-out.
- Little's law (L = λW) sizes pools and fleets in seconds.
- Queueing delay explodes near full utilization; keep headroom.
- Batching and async trade per-item latency for throughput.
