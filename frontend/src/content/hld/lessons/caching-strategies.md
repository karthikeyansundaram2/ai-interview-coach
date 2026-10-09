A cache keeps a copy of frequently used data somewhere faster than its source, usually memory. Choosing how reads populate the cache and how writes reach it determines both your speed and how stale the data can get.

## The analogy

A chef keeps the most-used spices on the counter instead of walking to the pantry each time. Cache-aside is the chef fetching from the pantry when the counter jar is empty and refilling it. Write-through is restocking the counter and the pantry at the same moment. Write-behind is putting new spices on the counter and telling an assistant to update the pantry later.

## Where caches live

```text
Browser cache -> CDN edge -> API gateway cache -> App in-process cache -> Distributed cache (Redis) -> DB buffer pool
```

Each layer is cheaper and faster than the next one inward. A request served at the CDN never touches your servers.

## Read strategies

**Cache-aside (lazy loading)**: the application owns the logic.

```text
read(key):
  v = cache.get(key)
  if v is None:
      v = db.query(key)
      cache.set(key, v, ttl=300)
  return v
```

Only requested data is cached, and a cache outage degrades to slower reads rather than failure. The cost is a slow first read (cold miss) and the possibility of stale entries until TTL or invalidation.

**Read-through**: the cache library or service loads from the database on a miss. The logic is the same as cache-aside, but centralized in the cache layer, which keeps application code simpler.

## Write strategies

**Write-through**: write to the cache and the database synchronously. Cached data is always fresh, but each write pays both latencies, and you may cache data that is never read.

**Write-around**: write only to the database and let reads populate the cache. Good when written data is rarely read soon after (logs, bulk imports).

**Write-behind (write-back)**: write to the cache and acknowledge; flush to the database asynchronously in batches. Very fast writes and absorbs bursts, but a cache node failure before flushing loses data. Suitable for counters, view counts, and metrics, not payments.

**Invalidate on write**: update the database, then delete the cache key. The next read repopulates it. This is the most common pairing with cache-aside because deleting is simpler and safer than computing the new cached value.

## Comparison

| Strategy | Read latency | Write latency | Staleness | Data loss risk | Typical use |
|---|---|---|---|---|---|
| Cache-aside + invalidate | Fast on hit | DB only | Small window | None | General default |
| Read-through | Fast on hit | DB only | Small window | None | Shared cache services |
| Write-through | Fast | DB + cache | Very low | None | Read-after-write heavy data |
| Write-around | Miss after write | DB only | Low | None | Write-once, read-rarely |
| Write-behind | Fast | Cache only | Low | Yes | Counters, analytics |

## What to cache and expected wins

Cache data that is read far more than written and is expensive to compute: user profiles, product pages, rendered feeds, session data, permission checks. With a 95% hit ratio, a 5 ms DB read and a 0.5 ms Redis read give an average of 0.95 × 0.5 + 0.05 × 5.5 ≈ 0.75 ms, and the database sees only 5% of the traffic. That load reduction is often more valuable than the latency gain.

## The race in cache-aside

```text
T1: read miss, loads OLD value from DB
T2: writes NEW value to DB, deletes cache key
T1: sets cache = OLD    <-- stale until TTL
```

Mitigations: always set a TTL as a safety net, use versioned values, or delete the key again after a short delay ("delayed double delete"), or drive invalidation from the database's change stream.

## Common mistakes

- Caching without TTLs, so bugs leave stale data forever.
- Updating the cache on write instead of deleting, which creates ordering races between concurrent writers.
- Treating the cache as the source of truth without persistence or replication.
- Caching per-user data under keys that accidentally collide across users, a security incident waiting to happen.

## In the interview

**Q: Which caching pattern would you use for user profiles?**
Cache-aside with Redis, a TTL of minutes, and delete-on-update. Profiles are read-heavy and tolerate a few seconds of staleness.

**Q: When is write-behind acceptable?**
When losing the last few seconds of writes is tolerable, such as view counters or rate-limit counters, and when write volume is high enough that batching meaningfully reduces database load.

**Q: What happens if Redis goes down?**
With cache-aside, reads fall through to the database. Protect it with rate limits or a circuit breaker, because a sudden 20x read load can take the database down too. Replicated Redis with automatic failover reduces the chance.

## Key takeaways

- Cache-aside with delete-on-write and a TTL is the safe default.
- Write-through favours freshness; write-behind favours write speed at a durability cost.
- Caches reduce database load as much as they reduce latency.
- Always plan for stale data, races, and cache failure.
