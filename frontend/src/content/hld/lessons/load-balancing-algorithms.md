Once traffic reaches a load balancer, an algorithm decides which backend gets each request. The right choice depends on whether requests are uniform, whether servers differ, and whether a client should keep landing on the same backend.

## The analogy

At a supermarket with several checkouts, you could rotate customers lane by lane (round robin), send each to the lane with the fewest people (least connections), glance at just two lanes and pick the shorter (power of two choices), or always send loyalty-card members to the same cashier who knows them (hashing).

## The algorithms

**Round robin**: backends in turn. Zero state, perfectly even request counts. Works when requests cost about the same and servers are identical.

**Weighted round robin**: a server with weight 3 gets three times as many requests. Useful for mixed instance sizes or slowly ramping a canary.

**Least connections**: send to the backend with the fewest active connections. Adapts to variable request duration and is a good default for long-lived connections like WebSockets.

**Least response time / latency-aware**: track recent latency (e.g. an exponentially weighted moving average) and prefer faster backends. Responsive to a degraded server, but can herd traffic if every balancer reacts to the same stale signal.

**Power of two choices (P2C)**: pick two backends at random and send to the one with fewer outstanding requests. Almost as good as checking every server, with tiny overhead and no herding, because different balancers pick different random pairs. Envoy and many service meshes use it as a default.

**IP hash / consistent hashing**: hash a key (client IP, user ID, cache key) to choose a backend, so the same key lands on the same server. Good for cache locality and sticky behaviour. With consistent hashing, adding a server moves only a fraction of keys.

**Random**: surprisingly effective at large scale; P2C is the improved version.

## Comparison

| Algorithm | State needed | Handles uneven request cost | Affinity | Notes |
|---|---|---|---|---|
| Round robin | None | Poorly | No | Simplest |
| Weighted RR | Weights | Poorly | No | Mixed hardware, canaries |
| Least connections | Active counts | Well | No | Long-lived connections |
| Least response time | Latency stats | Well | No | Risk of herding |
| Power of two choices | Outstanding counts | Well | No | Great default for distributed LBs |
| Consistent hash | Hash ring | Poorly | Yes | Cache locality, sharded state |

## Why multiple balancers change things

With one balancer, "least connections" has perfect information. With fifty balancers each seeing only its own traffic, every balancer may pick the same "least loaded" server at once and overload it. Randomized methods such as P2C avoid this synchronization.

```text
Balancer 1 \                     / Server A (looks idle to everyone) <-- overloaded
Balancer 2  >-- least-conn ---->
Balancer 3 /                     \ Server B, C, D (ignored)

With P2C: each balancer samples its own random pair -> load spreads out
```

## Slow start and outlier ejection

New servers have cold caches and JIT warm-up. **Slow start** ramps their weight over a minute or two. **Outlier ejection** temporarily removes a backend that returns many 5xx responses or times out, even if its health check passes.

## Common mistakes

- Round robin on workloads where some requests take 10 ms and others 10 seconds.
- Hash-based affinity without consistent hashing, so scaling the pool reshuffles every key.
- Latency-aware routing that floods the one fast server until it becomes slow.
- Sending full load to freshly started instances.

## In the interview

**Q: Which algorithm for a WebSocket gateway fleet?**
Least connections or P2C on connection counts, because connections last minutes to hours and round robin would leave newly added servers nearly empty.

**Q: How would you route requests so a server's local cache stays useful?**
Consistent hashing on the cache key or user ID, with bounded load (cap any server at, say, 1.25x the average) so a hot key cannot overload one server.

**Q: Why is power of two choices better than picking the least loaded server?**
It needs no global view and avoids herding when many balancers act on similar information, while still dramatically reducing the maximum load compared with pure random.

## Key takeaways

- Round robin is fine for uniform requests; least connections suits variable or long-lived ones.
- Power of two choices is a strong default for distributed balancers.
- Hash-based routing buys locality; use consistent hashing so resizing is cheap.
- Add slow start and outlier ejection to protect new and sick servers.
