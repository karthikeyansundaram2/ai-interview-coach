Search autocomplete (typeahead) suggests popular completions as the user types each character. It has a brutal latency budget, since a request fires on every keystroke, which pushes the design toward precomputed top-K results served from memory.

## Clarify requirements

**Functional**
- Given a prefix, return the top 5–10 suggestions ranked mainly by popularity.
- Suggestions update as query trends change (daily is fine, near real-time for trending is a bonus).
- Filter offensive or blocked terms.
- Optional: personalization and locale; scope initially to global popularity per language.

**Non-functional**
- 100M DAU, ~10 searches each, ~6 keystrokes per search that trigger a request.
- p99 latency < 50 ms end to end (server time ~10 ms).
- Highly available; slightly stale suggestions are fine.

## Back-of-the-envelope

- Suggestion requests: 100M × 10 × 6 = 6B/day → **60k QPS**, peak ~150k QPS.
- Client-side debouncing (e.g., 100 ms) and caching can cut this by 30–50%.
- Distinct queries worth suggesting: ~100M unique queries after filtering long-tail. Average 20 chars.
- Trie with top-K at each node: number of prefixes ≈ total characters ≈ 100M × 20 = 2B nodes in the worst case, but shared prefixes reduce it greatly. Storing top-10 per node as query IDs (10 × 8 B) makes memory in the tens of GB → shard or limit to queries above a popularity threshold.
- Query logs: 1B searches/day × 50 B ≈ 50 GB/day.

## API

```text
GET /v1/suggest?q=syst&lang=en&limit=8
  200: { "prefix": "syst", "suggestions": ["system design", "system of a down", "systemd", ...] }
  Cache-Control: public, max-age=300
```

Short GET responses for common prefixes are CDN- and browser-cacheable.

## Data model

```text
Offline:
  query_logs (data lake): ts, query, lang, region, user_id_hash
  query_counts: (lang, normalized_query) -> weighted count (time-decayed)

Online serving structure (per shard, in memory):
  Trie node: children map, top_k: [(query_id, score)]
  or a flat map: prefix -> [top_k queries]   (simpler, fast; prefix length capped at ~20)
```

The flat `prefix -> top-K` map is effectively a trie flattened into a hash table: lookups are O(1), at the cost of storing data per prefix.

## High-level design

```text
 Client (debounce 100 ms, local cache)
   |  GET /suggest?q=
   v
 CDN / edge cache (popular short prefixes)
   v
 LB --> Suggest service (stateless) --> Trie shard servers (in-memory, replicated)
                                           ^
                                           | load new snapshot (blue/green)
                                           |
 Search logs --> Kafka --> Aggregation (Spark daily / Flink for trending)
                              |
                              v
                       Trie builder --> versioned snapshot in object storage
```

**Read path**: the client debounces keystrokes and caches results; the CDN serves very common prefixes; otherwise the suggest service routes the prefix to the right shard, which returns precomputed top-K from memory in microseconds.

**Build path**: logs are aggregated into counts with time decay, filtered (blocklist, minimum frequency, PII), and turned into a top-K-per-prefix structure, serialized as a snapshot. Servers load the new snapshot alongside the old one and switch atomically.

## Deep dives

### 1. Precomputing top-K at each prefix

Searching a trie subtree for the top results at request time is too slow for short prefixes ("a" has millions of descendants). Instead, store the top-K completions at every node during the offline build: process queries sorted by score and push each into the top-K lists of all its prefixes (bounded by max prefix length). Reads become a single lookup. The cost is memory and rebuild time, both acceptable for daily builds.

### 2. Ranking and freshness

- Score = time-decayed frequency, e.g., sum of counts weighted by `0.5^(age_days / 7)`, so last week matters more than last year.
- **Trending**: a streaming job (Flink) counts queries in sliding windows (e.g., 1 hour) and detects spikes versus baseline. Trending terms are kept in a small, frequently updated overlay merged at query time with the daily snapshot.
- Personalization: blend global top-K with the user's own recent searches (stored client-side or in a per-user cache), re-ranked in the suggest service.

### 3. Sharding the trie

| Strategy | How | Issue |
|---|---|---|
| By first character(s) | Shard "a–c", "d–f"... | Uneven: "s" is far bigger than "x" |
| By prefix hash ranges | Hash of first 2–3 chars | Even-ish; each shard holds whole subtrees |
| Replicate everything | Each server holds full map | Simplest if it fits in memory (~tens of GB) |

If the filtered dataset fits in memory on one machine, replicate it fully and avoid sharding. Otherwise shard by a prefix-based hash computed on the first few characters, so every longer prefix of a given start lands on the same shard. Each shard has several replicas behind the suggest service.

### 4. Filtering and safety

Apply blocklists and classifiers during the build, plus a real-time denylist checked at serve time so an offensive suggestion can be removed within minutes without rebuilding. Exclude queries that look like personal data (emails, phone numbers) and require a minimum number of distinct users per suggestion to avoid leaking an individual's searches.

## Bottlenecks & scaling

- **QPS**: in-memory lookups are trivially fast; the limit is network and request handling. Scale suggest servers and replicas horizontally; use CDN and client caching.
- **Snapshot size and load time**: build compact structures (arrays + IDs, or FSTs), load from object storage in parallel, warm before switching.
- **Hot prefixes**: one- and two-letter prefixes are extremely common but have tiny result sets; cache them everywhere.
- **Multi-language**: separate snapshots per language/region.

## Follow-ups the interviewer may ask

- **Why not query Elasticsearch with a prefix query?** Possible at small scale, but it computes results per request; precomputed top-K in memory is far faster and cheaper at 100k+ QPS.
- **How do you handle typos?** Fuzzy matching on the prefix using edit-distance automata or a spelling-correction step; usually a later enhancement.
- **How quickly can a new trend appear?** With the streaming overlay, within minutes.
- **What about the very long tail of rare queries?** Exclude them below a threshold; they add memory but rarely help.
- **How would you A/B test ranking changes?** Serve different snapshot versions to cohorts and compare click-through on suggestions.
