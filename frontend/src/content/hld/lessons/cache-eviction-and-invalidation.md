A cache has limited memory and a copy of data that can go out of date. Eviction decides what to throw away when memory is full; invalidation decides when a cached copy is no longer true. Getting either wrong produces slow systems or wrong answers.

## The analogy

Your fridge is small. When it is full, you throw out what you have not touched in weeks (eviction). Separately, milk has a use-by date (TTL), and if someone tells you the batch was recalled, you throw it out immediately even though it looks fine (invalidation).

## Eviction policies

| Policy | Evicts | Strength | Weakness |
|---|---|---|---|
| LRU (least recently used) | Item not accessed for longest | Great for recency-driven workloads | A one-time scan of many keys flushes the useful working set |
| LFU (least frequently used) | Item with fewest accesses | Keeps long-term popular items | Slow to adapt when popularity shifts; needs counter decay |
| FIFO | Oldest inserted | Trivial | Ignores usage |
| Random | Any | Cheap, no metadata | Unpredictable hit ratio |
| TTL-based | Expired items | Bounds staleness | Not a capacity policy by itself |
| W-TinyLFU (Caffeine) | Admission filter + LRU segments | Near-optimal hit ratios | More complex |

Redis approximates LRU or LFU by sampling a few keys rather than maintaining a perfect ordering, configured with `maxmemory-policy` (for example `allkeys-lru`, `volatile-ttl`, `allkeys-lfu`).

A classic in-process LRU is a hash map plus a doubly linked list: the map gives O(1) lookup, the list gives O(1) move-to-front and evict-from-tail.

```text
HashMap: key -> node
List:  [MRU] A <-> D <-> B <-> C [LRU]   get(B): move B to front; full? evict C
```

## Invalidation approaches

**TTL expiry**: every entry expires after a fixed time. Simple and self-healing, but data can be stale for up to the TTL. Choose TTL by how stale the business can tolerate: seconds for prices, hours for country lists.

**Explicit invalidation on write**: after updating the database, delete the related cache keys. Fresh data quickly, but you must know every key that depends on the changed row (a user's name might appear in profile, feed, and comment caches).

**Event-driven invalidation**: services publish change events, or a CDC pipeline reads the database log, and a consumer deletes affected keys. Decouples writers from cache layout and catches writes from every code path, including manual fixes.

**Versioned keys**: embed a version in the key (`product:42:v17`). A write bumps the version, so old entries are never read again and simply age out. Great for CDN assets (`app.3f9a1c.js`).

**Write-through refresh**: update the cache in the same code path as the database. Fresh, but concurrent writers can race and leave the older value.

```text
Order svc --UPDATE--> DB --binlog--> CDC (Debezium) --> Kafka --> Invalidator --> DEL keys in Redis
```

## Consistency between cache and database

Because the cache and database are updated in separate steps, there is always a window of inconsistency. Strategies to keep it small:

- Delete rather than update the cache entry.
- Always pair invalidation with a TTL as a backstop.
- For read-your-own-writes, read from the database (or bypass the cache) for the writing user for a few seconds.
- Use CDC-driven invalidation so even writes that bypass your application still invalidate.

## Negative caching

Cache "not found" results with a short TTL. Otherwise, repeated lookups for missing keys (or malicious random IDs) go straight to the database every time. A Bloom filter of existing keys is another defence.

## Common mistakes

- Using LRU in a cache that is periodically scanned by a batch job, wiping the hot set.
- Long TTLs on data that users expect to change immediately, such as their own profile edits.
- Forgetting derived caches (lists, aggregates) when invalidating a single entity.
- No memory limit or eviction policy, so the cache node runs out of memory and crashes.

## In the interview

**Q: LRU or LFU for a product catalogue cache?**
LFU or a TinyLFU-style policy if a stable set of bestsellers dominates and batch reads might pollute recency; LRU if popularity shifts quickly, such as during flash sales.

**Q: How do you invalidate a user's name everywhere it is cached?**
Avoid denormalizing it into many cache entries; cache the user object separately and assemble views at read time. If denormalized, publish a `user.updated` event and have each owning service invalidate its keys.

**Q: What TTL would you choose?**
Base it on tolerated staleness and the cost of a miss. Add jitter (for example 300 s ± 10%) so keys written together do not expire together.

## Key takeaways

- Eviction manages capacity; invalidation manages correctness.
- LRU is the default; LFU-family policies resist scan pollution.
- Combine explicit or event-driven invalidation with TTLs as a safety net.
- Cache negative results and add jitter to TTLs.
