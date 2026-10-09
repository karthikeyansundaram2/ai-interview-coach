A URL shortener turns a long link into a short code like `sho.rt/aZ3kQ9p` and redirects anyone who visits it. It is a small problem with a very skewed read/write ratio, which makes it ideal for showing ID generation, caching, and data-model reasoning.

## Clarify requirements

**Functional**
- Create a short URL for a long URL; optionally a custom alias and an expiry.
- Redirect a short URL to the original.
- Basic click analytics (count per link, maybe by day and country).
- Out of scope: user accounts management UI, link editing, spam detection beyond a basic check.

**Non-functional**
- 100M new links per month; reads 100x writes.
- Redirect latency p99 under 50 ms server side.
- Highly available redirects (99.99%); creation can tolerate slightly lower availability.
- Short codes must be unique and not trivially enumerable.
- Links kept for 5 years by default.

## Back-of-the-envelope

- Writes: 100M / month ÷ (2.5 × 10^6 s/month) ≈ **40 writes/s**, peak ~200/s.
- Reads: 100 × 40 = **4,000 redirects/s** average, peak ~20k/s.
- Records over 5 years: 100M × 12 × 5 = **6 billion links**.
- Storage: ~500 bytes per record (long URL, code, owner, timestamps) → 6B × 500 B = **3 TB**, ~9 TB with 3x replication.
- Code length: base62 with 7 characters gives 62^7 ≈ **3.5 trillion** codes, far more than 6B. Six characters (~57B) would also work; seven leaves room.
- Cache: if 20% of links get 80% of traffic, caching the hottest ~100M mappings × 500 B ≈ 50 GB fits in a small Redis cluster.

## API

```text
POST /v1/urls
  body: { "longUrl": "...", "customAlias": "optional", "expiresAt": "optional" }
  headers: Authorization, Idempotency-Key
  201: { "shortUrl": "https://sho.rt/aZ3kQ9p", "code": "aZ3kQ9p" }
  409 if alias taken

GET /{code}
  301/302 Location: <longUrl>
  404 if unknown, 410 if expired

GET /v1/urls/{code}/stats?from=&to=
  200: { "clicks": 1234, "byDay": [...] }
```

**301 vs 302**: 301 (permanent) lets browsers cache the redirect, cutting load but hiding repeat clicks from analytics. 302 (temporary) sends every click to us. If analytics matters, use 302 with short `Cache-Control`.

## Data model

```text
urls
  code         (PK, string, 7 chars)
  long_url     (string, up to 2 KB)
  owner_id     (nullable)
  created_at
  expires_at   (nullable)

click_events (stream -> analytics store)
  code, ts, country, referrer, user_agent_hash
```

The access pattern is a single key lookup by code, so a key-value store (DynamoDB, Cassandra) is a natural fit and scales horizontally without effort. A sharded relational database also works at 3 TB; the deciding factor is operational preference. Partition by code (hash).

## High-level design

```text
                     +------------------+
 Client ---GET /code-> CDN / edge (opt) |
                     +--------+---------+
                              v
                      +---------------+
                      | Load balancer |
                      +-------+-------+
              +---------------+----------------+
              v                                v
      +---------------+                +---------------+
      | Redirect svc  |                | Create svc    |
      +---+-------+---+                +---+-------+---+
          |       |                        |       |
          v       v                        v       v
      +-------+  +-----------+       +----------+ +-----------+
      | Redis |  | KV store  |<------| ID / key | | KV store  |
      | cache |  | (urls)    |       | generator| | (write)   |
      +-------+  +-----------+       +----------+ +-----------+
          |
          +--> click events --> Kafka --> stream aggregator --> analytics DB
```

**Create flow**: the create service validates the URL, obtains a unique code (see deep dive), writes `code -> long_url` with a conditional "only if not exists" write, and returns the short URL.

**Redirect flow**: the redirect service checks Redis; on a miss, reads the KV store and populates the cache with a TTL. It returns a 302 and asynchronously emits a click event to Kafka. The redirect never waits on analytics.

## Deep dives

### 1. Generating short codes

| Option | How | Pros | Cons |
|---|---|---|---|
| Hash + truncate | base62(first 43 bits of SHA-256(longUrl + salt)) | Stateless, same URL may map to same code | Collisions must be detected and retried |
| Counter + base62 | Global counter, encode as base62 | No collisions, short codes | Sequential codes are guessable; counter is a bottleneck |
| Range allocation | Each server leases blocks of 10k IDs from a coordinator, then scrambles | No per-request coordination | Allocator must be HA; gaps after crashes are harmless |
| Pre-generated key pool | Offline job creates random unused codes; servers pop batches | Fast, random-looking | Extra storage and a pool service |

A good answer: **range allocation** from a small, highly available allocator (a DynamoDB counter or etcd), each server converting its local counter to base62 after passing it through a reversible bit permutation (or encrypting with a block cipher such as a Feistel network) so codes look random and are not enumerable. Custom aliases use a conditional insert and fail with 409 if taken.

### 2. Caching and hot links

A viral link can get 50k clicks/s. Redis handles that per shard, but hot keys concentrate on one node. Add a short-lived in-process cache (a few seconds) on redirect servers for the hottest codes, and optionally serve redirects from CDN edge workers with a short TTL. Use cache-aside with TTL and negative caching for unknown codes to block enumeration attacks hitting the database.

### 3. Analytics without slowing redirects

Emit click events asynchronously (in-memory buffer → Kafka). A stream processor aggregates counts per code per minute/day and writes them to an OLAP store (ClickHouse, Druid) or counters in Cassandra. If Kafka is unavailable, drop or locally buffer events: redirect availability matters more than perfect analytics.

### 4. Expiry and cleanup

Store `expires_at`; the redirect path checks it and returns 410. Use the database's TTL feature (DynamoDB TTL, Cassandra TTL) to delete expired rows automatically. Avoid reusing expired codes for a long grace period to prevent old links pointing to new destinations.

## Bottlenecks & scaling

- **Redirect tier**: stateless, scale horizontally; cache hit ratio above 90% keeps the store load at a few thousand reads/s.
- **Store**: 6B rows partitioned by code spreads evenly; add nodes as storage grows.
- **ID allocator**: called once per 10k creates, so negligible load; replicate it.
- **Abuse**: rate limit creation per user/IP, check URLs against malware blocklists asynchronously, and allow takedowns by invalidating cache entries.
- **Multi-region**: replicate the URL table globally (writes are rare and immutable, so conflicts don't arise if codes are unique per allocator range) and serve redirects from the nearest region.

## Follow-ups the interviewer may ask

- **Same long URL submitted twice: same code?** Optional. Keep a secondary index from hash(long_url, owner) to code if deduplication is desired; otherwise create a new code each time (simpler, allows per-campaign analytics).
- **How do you prevent enumeration?** Non-sequential codes via permutation or random pool, plus rate limiting on 404s.
- **How would you support link editing?** Make the mapping mutable and use 302 redirects with short cache TTLs, invalidating cache on update.
- **What if Redis goes down?** Fall back to the KV store, which can absorb the read rate with a circuit breaker and in-process caching to protect it.
- **Why not 301 everywhere?** Lower load, but you lose visibility of repeat clicks and cannot change destinations reliably.
