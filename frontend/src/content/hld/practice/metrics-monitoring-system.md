A metrics and monitoring system collects numeric measurements from thousands of services and hosts, stores them as time series, powers dashboards, and fires alerts. The defining challenge is a firehose of tiny writes plus queries that scan large time ranges, which calls for specialized time-series storage.

## Clarify requirements

**Functional**
- Ingest metrics (counters, gauges, histograms) with labels, e.g. `http_requests_total{service="orders", status="500"}`.
- Query by metric name, label filters, and time range with aggregations (rate, sum, percentiles), for dashboards.
- Alerting rules evaluated continuously; notify via pager, chat, email.
- Retention: raw 10 s resolution for 15 days, downsampled 1 min for 90 days, 1 h for 2 years.
- Out of scope: logs and traces (mention integration).

**Non-functional**
- 10M active time series; 10 s scrape interval.
- Ingestion must not drop data under bursts; dashboards p99 < 1 s for common queries.
- Alerting must keep working even if parts of the system degrade (monitoring must be more reliable than what it monitors).

## Back-of-the-envelope

- Samples: 10M series / 10 s = **1M samples/s**.
- Raw sample = 16 B (8 B timestamp + 8 B value); time-series compression (delta-of-delta timestamps, XOR floats) brings it to **~1.5 B/sample**.
- Per day: 1M × 86,400 ≈ 86B samples × 1.5 B ≈ **130 GB/day**; 15 days raw ≈ 2 TB (×3 replication ≈ 6 TB).
- Downsampled data is tiny in comparison (1-min rollups are 1/6 of raw; 1-hour rollups 1/360).
- Index: 10M series × ~200 B of labels ≈ 2 GB, kept in memory.
- Queries: a dashboard panel over 50 series for 24 h at 10 s = 50 × 8,640 = 432k samples, which is fine; over 30 days use 1-min rollups.

## API

```text
Ingestion (push):
POST /v1/write   (batched, compressed protobuf)
  [ { "labels": {"__name__":"http_requests_total","service":"orders","status":"500"},
      "samples": [[ts, value], ...] } ]

Or pull: agents scrape /metrics endpoints (Prometheus model) and remote-write.

Query:
GET /v1/query_range?q=sum(rate(http_requests_total{service="orders"}[5m])) by (status)&start=&end=&step=60s

Alerts:
PUT /v1/alerts/rules/{id}  { "expr": "...", "for": "5m", "severity": "page", "route": "team-orders" }
```

## Data model

```text
Series identity: series_id = hash(sorted label set)
Inverted index (in memory, persisted per block):
  label pair -> posting list of series_ids     e.g. service="orders" -> [12, 98, 4410, ...]

Chunks (per series, per 2-hour block):
  series_id, start_ts, end_ts, compressed samples (Gorilla-style encoding)

Blocks on disk / object storage:
  2h blocks -> compacted into larger blocks (e.g. 24h); rollups stored as separate series
```

## High-level design

```text
 Services/hosts --> Agents (scrape or receive, buffer, batch)
                       |
                       v
                 Kafka (partitioned by series hash)  <-- buffers bursts, decouples
                       |
                       v
            Ingesters (sharded by series hash, replicated x3)
              - in-memory head block (recent 2h)
              - WAL for crash recovery
              - flush compressed blocks
                       |
                       v
            Object storage (long-term blocks)  <--- Compactor / Downsampler
                       ^
                       |
 Grafana --> Query frontend (split by time, cache results)
                       |
                 Queriers: recent data from ingesters, older from object storage (via store gateways)

 Rule evaluator / Alert manager: evaluates rules every 15-60 s, dedups, groups, routes notifications
```

## Deep dives

### 1. Write path and time-series storage

- Writes are append-only, ordered by time per series: ideal for an in-memory head block plus WAL, flushed periodically into immutable compressed chunks (an LSM-like design specialized for time series).
- **Gorilla compression**: store timestamp delta-of-deltas (regular scrape intervals compress to a few bits) and XOR consecutive float values (similar values share most bits). This yields roughly 10x compression.
- Shard series across ingesters by consistent hashing of series ID, replicate each to 3 ingesters; queries deduplicate.
- Kafka in front absorbs spikes and lets ingesters restart without data loss.

### 2. Cardinality control

The most common way to break a metrics system is high cardinality: a label like `user_id` turns one metric into millions of series, each with index entries and memory.

- Enforce per-tenant limits on active series and labels per metric; reject or drop offending series and alert the owner.
- Provide guidance: IDs belong in logs/traces, not metric labels.
- Track cardinality per metric and show it to teams.

### 3. Query performance

- Resolve label matchers via the inverted index (intersect posting lists), then fetch only matching chunks for the time range.
- **Downsampling**: serve long-range queries from 1-min or 1-hour rollups (store min, max, sum, count per interval so averages and extremes remain correct).
- **Query frontend**: split a 30-day query into daily sub-queries executed in parallel; cache results of completed (immutable) days.
- **Histograms** for latency: store bucket counters so percentiles can be computed across many instances correctly (averaging percentiles is wrong).
- Limits on samples scanned per query to protect the cluster.

### 4. Alerting reliability

- The rule evaluator runs independently from dashboards, with its own query path to recent data (ingesters), and is replicated (two evaluators; alert manager deduplicates).
- `for: 5m` clauses avoid flapping; alert manager groups related alerts, applies silences and inhibition (don't page for every service when the database is down), and routes by team.
- **Meta-monitoring**: a separate, minimal monitoring stack watches the monitoring system, plus a "dead man's switch" alert that should always fire; if notifications stop arriving, something is broken.

## Bottlenecks & scaling

- **Ingest**: scale Kafka partitions and ingesters horizontally by series hash.
- **Memory**: head blocks and index dominate ingester memory; proportional to active series, hence cardinality limits.
- **Storage**: object storage for long-term blocks is cheap and effectively unlimited.
- **Expensive queries**: query frontends, result caching, and per-tenant query limits.
- **Multi-tenancy**: tenant ID as a label/namespace with quotas on ingestion and query.

## Follow-ups the interviewer may ask

- **Push or pull?** Pull (scraping) gives easy health detection ("target down") and central control of rate; push suits short-lived jobs and serverless. Many systems support both via an agent.
- **Why not store metrics in a relational DB?** 1M inserts/s of tiny rows with large-range scans is a poor fit; time-series compression and append-only chunks are far more efficient.
- **How do you handle late or out-of-order samples?** Accept within a small window into the head block; reject very old samples or route them to a backfill path.
- **How do you compute p99 latency across 500 instances?** Sum histogram bucket counters across instances, then compute the quantile from the merged histogram.
- **How do logs and traces fit in?** Separate stores, linked by labels and exemplars (trace IDs attached to histogram samples).
