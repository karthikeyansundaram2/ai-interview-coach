Caches fail in two dramatic ways: a popular entry expires and thousands of requests stampede the database at once, or a single key gets so much traffic that one cache node melts. Both appear exactly when traffic is highest, which is why interviewers love asking about them.

## The analogy

A stampede is a bakery that sells out of its most popular bread at 9 a.m., and every customer in the queue runs to the kitchen at the same moment demanding a fresh loaf. A hot key is a single cashier who happens to be the only one selling concert tickets while the other ten stand idle.

## Cache stampede (thundering herd)

```text
t=0     key "homepage" expires
t=0+    5,000 req/s all miss
        all 5,000 run the same 200 ms DB query
        DB saturates -> queries slow to 5 s -> more requests pile up -> outage
```

### Defences

**Request coalescing (single flight)**: only one request per key recomputes; the others wait for its result. Within a process this is a lock per key; across a fleet, use a short Redis lock:

```text
if cache miss:
    if SET lock:key NX PX 5000 succeeds:
        value = load_from_db(); cache.set(key, value); DEL lock:key
    else:
        sleep briefly and retry cache read (or serve stale)
```

**Serve stale while revalidating**: keep the old value past its soft expiry and return it while one background worker refreshes. Users never see a miss. HTTP has the same idea in `stale-while-revalidate`.

**Probabilistic early expiration**: each reader, as expiry approaches, has a small and increasing chance of refreshing early. Refreshes spread out instead of happening all at once.

**TTL jitter**: when many keys are populated together (after a deploy or warm-up), randomize TTLs so they do not expire simultaneously.

**Pre-warming**: load known hot keys before shifting traffic to a new cache cluster.

## Hot keys

A celebrity profile, a flash-sale product, or a viral post can draw hundreds of thousands of reads per second to one key. Since a key lives on one shard, one Redis node takes all of it, and a single Redis node tops out around 100k–200k operations per second.

### Defences

| Technique | How | Trade-off |
|---|---|---|
| Local in-process cache | Keep hot keys in app memory for 1–5 s | Brief staleness; memory per instance |
| Key replication / salting | Store copies `post:9:0` … `post:9:9`; readers pick a random suffix | Writes must update all copies |
| Read replicas | Spread reads across replica nodes of the shard | Replication lag |
| CDN / edge caching | Serve hot public content at the edge | Only for cacheable, public data |
| Hot key detection | Sample access counts, auto-promote to local cache | Extra machinery |

```text
               +--> app1 [local LRU: post:9] ---+
Requests ------+--> app2 [local LRU: post:9] ---+--> Redis shard 3 (sees a trickle)
               +--> app3 [local LRU: post:9] ---+
```

### Hot keys on writes

Writes to one key (a like counter on a viral post) are harder. Options: shard the counter into N sub-counters and sum on read; buffer increments in memory and flush every second; or accept approximate counts.

## Cache penetration and avalanche

Two related failure modes:

- **Penetration**: requests for keys that do not exist bypass the cache every time. Cache negative results briefly or use a Bloom filter.
- **Avalanche**: a large fraction of the cache is lost at once (a cluster restart or mass expiry). Use jittered TTLs, replicated caches, and load shedding or circuit breakers in front of the database.

## Common mistakes

- Using a distributed lock without a timeout, so a crashed holder blocks the key forever.
- Making every waiting request poll the lock aggressively, creating a new herd on Redis.
- Assuming consistent hashing solves hot keys. It balances many keys, not one popular key.
- Forgetting that a local cache multiplies staleness across hundreds of instances.

## In the interview

**Q: A celebrity with 100M followers posts. How do you keep the post's cache from melting?**
Detect the key as hot and cache it in-process on every app server for a few seconds, replicate it under several salted keys across shards, and serve public media through a CDN. Like counts are sharded counters aggregated asynchronously.

**Q: How do you stop a stampede when a heavy key expires?**
Serve the stale value while a single worker refreshes it, guarded by a short-lived lock. Add TTL jitter and early probabilistic refresh so expiry is not synchronized.

**Q: What if the whole Redis cluster restarts?**
The database would see the full read load. Protect it with rate limiting or a circuit breaker, warm the cache gradually, and serve degraded responses until hit ratios recover.

## Key takeaways

- Stampedes come from synchronized misses; coalescing and stale-while-revalidate stop them.
- Hot keys overload a single shard; local caching and key replication spread the load.
- Jitter TTLs and protect the database with load shedding.
- Write-hot keys need sharded or buffered counters.
