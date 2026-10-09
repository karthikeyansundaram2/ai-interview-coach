An ad click aggregation system counts billions of ad clicks per day, per ad and per minute, for real-time dashboards and for billing advertisers. Because the numbers become invoices, the design must handle duplicates, late events, and failures without over- or under-counting.

## Clarify requirements

**Functional**
- Ingest click events: `click_id, ad_id, campaign_id, user_id, ts, ip, country, device`.
- Query click counts per ad (and campaign) over the last M minutes, aggregated per minute.
- Top-N most clicked ads in the last M minutes, filterable by country/device.
- Feed billing with accurate daily totals.
- Out of scope: impression tracking (same pipeline pattern), fraud ML models (integrate as a filter).

**Non-functional**
- 10B clicks/day; peak 5x average.
- Dashboard freshness within ~1 minute.
- Billing accuracy: exactly-once counting (no double counting, no loss); final totals reconciled.
- Handle late events (mobile clients offline) up to some bound.
- Fault tolerant, horizontally scalable.

## Back-of-the-envelope

- 10B/day ÷ 10^5 ≈ **100k clicks/s** average, **500k/s** peak.
- Event size ~200 B → 20 MB/s average, 100 MB/s peak; raw storage 2 TB/day.
- Active ads: ~2M; per-minute aggregates: 2M ads × 1,440 minutes × ~50 B ≈ worst case 144 GB/day, but most ads have no clicks in most minutes, so actual is far smaller.
- Kafka: at ~10 MB/s per partition comfortably → at least 10–20 partitions for throughput; use more (e.g., 64–128) for consumer parallelism.

## API

```text
Ingest (from ad servers / click redirect service):
  click redirect: GET /c?ad=...&sig=... -> log event, 302 to advertiser landing page

Query service:
GET /v1/ads/{adId}/clicks?from=...&to=...&granularity=1m
  -> { "adId", "points": [ { "ts": "...", "clicks": 1234 } ] }
GET /v1/ads/top?window=5m&limit=100&country=IN
  -> { "ads": [ { "adId", "clicks" } ] }
```

## Data model

```text
Raw events (Kafka topic "clicks", partitioned by ad_id; also archived to data lake as Parquet):
  click_id, ad_id, campaign_id, ts (event time), user_id, ip, country, device, sig

Aggregates (OLAP store: ClickHouse / Druid / Pinot, or Cassandra for simple lookups):
  ad_click_minute: (ad_id, minute) -> clicks, filter dimensions (country, device) as columns
  top_ads_minute:  (window_end, filter_key) -> ranked list of (ad_id, clicks)

Dedup state (in stream processor state, TTL): click_id seen set
```

## High-level design

```text
 Users click ad --> Click redirect service (validates signature, logs event, 302)
                         |
                         v
                 Kafka "clicks.raw" (partition by ad_id, replicated, 7-day retention)
                         |                                   |
                         v                                   v
         Stream processor (Flink)                   Raw archive (S3/data lake)
           - validate, filter bots                           |
           - dedup by click_id                               v
           - 1-min tumbling event-time windows       Daily batch job (Spark)
             per ad_id (+ dimensions)                 - recompute exact totals
           - top-N per window                         - reconcile with streaming
           - watermarks + allowed lateness            - produce billing records
                         |                                   |
                         v                                   v
             Aggregates DB (OLAP) <------------------- Billing DB
                         |
                 Query service + cache --> dashboards
```

## Deep dives

### 1. Exactly-once counting in the stream

- Kafka retains raw events, so the processor can always replay.
- Flink checkpoints its state (window counts, dedup sets) together with the Kafka offsets it has consumed. On failure it restores both and replays from those offsets, so every event is reflected exactly once in internal state.
- The sink must not double-write on replay: either use transactional writes committed with checkpoints (two-phase commit sink), or make writes idempotent upserts keyed by `(ad_id, minute)` with the full value (not increments). Idempotent overwrite of window results is the simplest robust approach.
- Duplicates from clients (double clicks, retries) are separate from processing duplicates: dedup by `click_id` within a time-bounded state (e.g., keyed state with 1-hour TTL).

### 2. Event time, watermarks, and late data

Clicks are aggregated by event time (when the user clicked), not arrival time. A watermark of, say, 1 minute behind the maximum seen event time decides when a window closes and is emitted. Events arriving after that but within allowed lateness (e.g., 10 minutes) update the window and re-emit the corrected count (an upsert). Events later than that go to a side output and are included by the daily batch reconciliation. This balances dashboard freshness against completeness.

### 3. Hot ads and partitioning

Partitioning by ad_id keeps all clicks of an ad on one partition for simple aggregation, but a viral ad (or a Super Bowl campaign) can overload one partition and one task.

- **Two-stage aggregation**: first aggregate by `(ad_id, random salt 0..9)` across many tasks, then combine the partial counts by ad_id in a second stage. Removes the hot spot at the cost of an extra step.
- Pre-aggregate in ad servers or the click service (local per-second counts) where acceptable, sending counts plus raw events for auditing.
- Top-N: each parallel task computes a local top-N per window; a final operator merges them (the global top-N is guaranteed to be within the union of local top-Ns when partitioned by ad_id).

### 4. Reconciliation for billing (lambda-style)

Real-time counts drive dashboards and budget pacing; invoices use the batch-recomputed totals from the raw archive, which incorporates very late data, fraud filtering updates, and bug fixes. A reconciliation job compares batch versus streaming totals per ad per day and alerts on discrepancies above a threshold. If the streaming logic had a bug, replay from Kafka (or the archive) into a new output table and switch over.

## Bottlenecks & scaling

- **Ingestion**: click services are stateless; Kafka partitions scale throughput; producers use acks=all and idempotent producers.
- **Processor state**: dedup sets are the biggest state (~100k/s × 3,600 s × 16 B ≈ 6 GB for a one-hour window across the job); keep in RocksDB state backend, sized across tasks.
- **OLAP queries**: pre-aggregated per-minute rows make dashboards cheap; roll up to hourly/daily for longer ranges.
- **Fraud/bot traffic**: filter by IP reputation, rate patterns, and signature validation before counting billable clicks; keep invalid clicks counted separately for transparency.
- **Multi-region**: aggregate per region, then merge globally; or route all clicks for an ad's partition to a single processing region.

## Follow-ups the interviewer may ask

- **Why not increment counters in Redis per click?** At 500k/s it works for approximate counts, but you lose exactly-once guarantees, replayability, and dimension slicing; a stream processor with checkpointed state is more robust.
- **How do you recover from a processor bug that over-counted for 2 hours?** Fix the job, replay that time range from Kafka/archive into corrected aggregates, and rely on batch totals for billing.
- **How would you count unique users per ad?** HyperLogLog sketches per window, mergeable across partitions and time.
- **What if Kafka is down?** Click services buffer locally to disk briefly and keep redirecting users; redirect availability must not depend on analytics.
- **How do you handle time zones for daily billing?** Aggregate in UTC at minute granularity; daily totals in any advertiser time zone are sums of minute buckets.
