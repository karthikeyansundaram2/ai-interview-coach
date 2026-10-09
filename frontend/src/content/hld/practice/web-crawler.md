A web crawler downloads pages, extracts links, and keeps going, building the raw corpus for a search engine. The difficulty is not fetching a page; it is crawling billions of pages politely, avoiding duplicates and traps, and deciding what to fetch next.

## Clarify requirements

**Functional**
- Start from seed URLs, fetch pages, extract links, and enqueue new URLs.
- Store page content (HTML) and metadata for downstream indexing.
- Respect robots.txt and per-site crawl delays.
- Recrawl pages periodically based on how often they change.
- Scope: HTML only (mention images/PDFs as extensions).

**Non-functional**
- Crawl 1B pages per week (plus recrawls).
- Politeness: at most one concurrent connection per host and a delay between requests.
- Robust to malformed HTML, slow servers, spider traps.
- Scalable horizontally; resumable after failures.

## Back-of-the-envelope

- 1B pages / week ÷ (7 × 10^5 s) ≈ **1,650 pages/s**, plan for ~3k/s.
- Average page ~100 KB uncompressed (~20 KB compressed) → 1B × 100 KB = **100 TB/week raw**, ~20 TB compressed.
- Bandwidth: 3k/s × 100 KB = **300 MB/s ≈ 2.4 Gbps** inbound.
- Fetch latency ~1 s per page on average; by Little's law, 3k/s × 1 s = **3,000 concurrent fetches**; with async I/O, ~30 machines handling 100 connections each is plenty.
- URL frontier: tens of billions of discovered URLs × ~100 B ≈ terabytes: must be disk-backed.
- Seen-URL set: 10B URLs; a Bloom filter at 1% false positives needs ~10 bits/URL ≈ 12.5 GB.

## API

Mostly internal; a control-plane API:

```text
POST /v1/seeds           { "urls": [...], "priority": "high" }
GET  /v1/crawl/stats     -> pages/s, errors, frontier size, per-host backlog
PUT  /v1/hosts/{host}/policy  { "maxRps": 0.5, "blocked": false }
```

Downstream consumers read crawled pages from object storage and a "page.fetched" event stream.

## Data model

```text
url_state (KV, keyed by hash(normalized_url))
  url, host, last_fetched, next_fetch_at, http_status, content_hash, change_rate, depth, priority

host_state (KV, keyed by host)
  robots_rules (cached, TTL 24h), crawl_delay, last_access, error_rate, ip

pages (object storage): key = hash(url)/fetch_ts -> compressed HTML + headers
content_fingerprints: simhash -> canonical url (near-duplicate detection)
```

## High-level design

```text
 Seeds ---> +-----------------------------+
            |        URL Frontier         |
            |  priority queues (front)    |
            |  per-host queues (back)     |<-------------------------------+
            +--------------+--------------+                                |
                           | next URL whose host is ready                  |
                           v                                               |
               +-----------------------+    +-------------+                |
               | Fetcher workers       |--->| DNS cache   |                |
               | (async HTTP, robots)  |    +-------------+                |
               +-----------+-----------+                                   |
                           v                                               |
               +-----------------------+                                   |
               | Content processor     |--> Object storage (pages)         |
               | - dedup (hash/simhash)|--> Kafka "page.fetched" --> indexer
               | - parse, extract links|                                   |
               +-----------+-----------+                                   |
                           v                                               |
               +-----------------------+                                   |
               | URL filter & dedup    | (normalize, scope, Bloom filter,  |
               |                       |  url_state lookup) ---------------+
               +-----------------------+
```

## Deep dives

### 1. The URL frontier: priority and politeness

The frontier decides what to crawl next. A two-layer design works well:

- **Front queues (priority)**: URLs are assigned a priority from signals such as PageRank estimates, domain importance, and freshness need. Higher-priority queues are sampled more often.
- **Back queues (politeness)**: each back queue holds URLs for a single host. A heap keyed by "next allowed fetch time" per host tells fetchers which host is ready. After fetching from a host, its next time is set to now + crawl delay (from robots.txt or adaptive based on response time).
- Partition the frontier across crawler nodes **by host** (consistent hashing on hostname), so one node owns each host's politeness state with no coordination.
- The frontier is mostly on disk (e.g., RocksDB or Kafka-backed queues) with in-memory buffers at the heads.

### 2. Deduplication

- **URL dedup**: normalize URLs (lowercase host, remove default ports, sort query params, strip fragments and tracking params), then check a Bloom filter followed by `url_state` for authoritative status. The Bloom filter avoids most store lookups; false positives mean occasionally skipping a new URL, which is acceptable.
- **Exact content dedup**: hash the content (e.g., SHA-256 of normalized text); identical pages from mirrors are stored once.
- **Near-duplicate dedup**: SimHash (64-bit fingerprints where similar documents differ in few bits) catches pages differing only in ads or timestamps.

### 3. Robustness: traps, failures, and bad actors

- **Spider traps** (infinite calendars, session IDs in URLs): cap URL length, path depth, and pages per host per crawl cycle; detect repeating path patterns.
- **Slow or hostile servers**: strict connect/read timeouts, max page size (e.g., 10 MB), and per-host error tracking that backs off failing hosts.
- **DNS**: a local caching resolver; DNS lookups otherwise become a bottleneck.
- **Fault tolerance**: fetchers are stateless; frontier state is persisted so a node crash only loses in-flight fetches, which are retried.

### 4. Freshness and recrawl scheduling

Pages change at very different rates (news homepages hourly, archives never). Track `change_rate` from past fetches (did the content hash change?) and schedule `next_fetch_at` adaptively: halve the interval when changed, double when unchanged, within bounds. Use conditional requests (`If-Modified-Since`, `ETag`) to save bandwidth on unchanged pages.

## Bottlenecks & scaling

- **Frontier throughput and size**: partitioned by host across nodes; disk-backed.
- **Network**: multiple gigabits; distribute crawlers across regions to be close to hosts.
- **Storage**: compressed pages in object storage; only the latest N versions retained.
- **Hot hosts**: a giant site (e.g., a wiki) is limited by politeness, not our capacity; negotiate higher rates or use sitemaps.
- **Link extraction CPU**: parsing is parallel and stateless; scale processors independently via Kafka.

## Follow-ups the interviewer may ask

- **How do you respect robots.txt?** Fetch and cache it per host (24 h TTL) before crawling; check every URL against its rules; honour crawl-delay.
- **How do you crawl JavaScript-heavy sites?** A separate, much slower rendering tier with headless browsers, used only for high-value hosts.
- **How do you prioritize?** Combine link-based importance, domain quality, freshness need, and newness of URLs; reserve capacity for recrawls versus discovery.
- **How would you extend to images and PDFs?** Separate content-type pipelines and storage, with type-specific processors.
- **What if a crawler node dies?** Its host partitions are reassigned via consistent hashing; persisted frontier state lets the new owner resume.
