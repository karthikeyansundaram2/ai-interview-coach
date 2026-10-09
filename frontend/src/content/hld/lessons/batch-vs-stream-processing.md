Data pipelines either process a bounded pile of data on a schedule (batch) or process an unbounded flow of events continuously (stream). The choice trades freshness against simplicity, cost, and how easily you can correct mistakes.

## The analogy

Batch processing is doing the household laundry once a week: efficient, predictable, but your favourite shirt is unavailable until laundry day. Stream processing is a hotel laundry that washes towels as soon as they arrive: always fresh, but it needs staff on duty around the clock and must cope with towels arriving out of order.

## Batch processing

- Input is a bounded dataset (yesterday's logs, a table snapshot). Jobs run on a schedule (hourly, nightly).
- Frameworks: Spark, Hadoop MapReduce, warehouse SQL (BigQuery, Snowflake, Redshift), dbt.
- Simple semantics: rerun a failed job over the same input and get the same output.
- Latency: minutes to hours.
- Good for: reports, billing reconciliation, ML training sets, backfills, complex joins over full history.

## Stream processing

- Input is unbounded: events arrive continuously from Kafka, Kinesis, or CDC.
- Frameworks: Flink, Kafka Streams, Spark Structured Streaming, Beam/Dataflow.
- Latency: milliseconds to seconds.
- Good for: fraud detection, real-time dashboards, alerting, live recommendations, keeping caches and search indexes updated.

## Stream concepts you must know

**Event time vs processing time**: event time is when it happened (on the phone); processing time is when your job sees it. Mobile events can arrive minutes or hours late. Correct aggregations use event time.

**Windows**:

```text
Tumbling (fixed, non-overlapping):  [00-05)[05-10)[10-15)
Sliding (overlapping):              [00-10) [05-15) [10-20)  every 5 min
Session (gap-based):                [user active ... 30 min idle] -> window closes
```

**Watermarks**: the job's estimate that "all events up to time T have probably arrived". When the watermark passes the end of a window, the window's result is emitted. **Allowed lateness** keeps windows open a little longer, updating results when stragglers arrive; very late events go to a side output.

**State**: aggregations, joins, and deduplication need state (counts per key, recent events). Engines like Flink keep state locally (RocksDB) and checkpoint it to durable storage.

**Exactly-once processing**: achieved via checkpoints aligned with source offsets, plus transactional or idempotent sinks. If the job fails, it restores state and offsets from the last checkpoint and replays.

## Architectures

```text
Lambda:
 events --> Kafka --+--> Stream job --> speed views (approximate, fresh)
                    +--> Data lake --> Batch job --> batch views (accurate)  --> serving merges both

Kappa:
 events --> Kafka (long retention) --> Stream job --> serving store
            reprocess = start a new job from an earlier offset, then switch
```

| | Lambda | Kappa |
|---|---|---|
| Code paths | Two (batch + stream) | One |
| Correction | Batch recomputes truth | Replay the log |
| Complexity | High (keep both in sync) | Lower, needs long retention and solid streaming engine |

Modern lakehouse setups (Iceberg, Delta, Hudi tables) blur the line: streaming writes into tables that batch jobs and SQL engines query.

## Choosing

| Question | Leans batch | Leans stream |
|---|---|---|
| How fresh must results be? | Hours OK | Seconds |
| Is the logic complex across full history? | Yes | Mostly incremental |
| Cost sensitivity? | Run when needed | Always-on compute |
| Need for exact correctness (billing)? | Batch reconciliation | Stream for preview, batch for final |

A common answer: stream for real-time views, batch for authoritative reconciliation.

## Common mistakes

- Aggregating by processing time and getting wrong results when a backlog is replayed.
- No plan for late data.
- Unbounded state (for example deduplication sets without TTL) that grows until the job crashes.
- Building streaming for a report someone reads once a day.

## In the interview

**Q: How would you count ad clicks per minute per campaign?**
Stream from Kafka into Flink, deduplicate by click ID, aggregate in one-minute tumbling event-time windows with a watermark of a minute or two plus allowed lateness, and write to an OLAP store. A nightly batch job over raw logs reconciles totals for billing.

**Q: What is a watermark?**
A moving threshold in event time that signals the job may consider earlier windows complete. It balances latency (emit early) against completeness (wait for stragglers).

**Q: How do you fix a bug in a streaming job's logic?**
Deploy the fixed job reading from an earlier offset into a new output table, let it catch up, then switch readers to the new table (the Kappa approach), or recompute affected periods with a batch job.

## Key takeaways

- Batch: bounded data, simple reruns, high latency. Stream: unbounded data, low latency, more complexity.
- Use event time, windows, and watermarks for correct streaming aggregates.
- Exactly-once in streaming = checkpointed state + replayable source + idempotent or transactional sinks.
- Many systems combine streaming freshness with batch reconciliation.
