Change data capture (CDC) turns a database's own change log into a stream of events. It is the cleanest way to keep caches, search indexes, warehouses, and other services in sync with a source of truth without dual writes.

## The analogy

Instead of asking every bank teller to also phone head office after each transaction (and hoping they never forget), head office simply reads the bank's official ledger as it is written and copies each new line. Nothing can be missed, because the ledger is the record.

## Why CDC

Applications often write to a database and then also update a cache, a search index, or publish an event. Those dual writes fail independently: a crash between them leaves systems inconsistent, and writes from other paths (migrations, admin scripts, other services) are never propagated. CDC reads what actually committed, in commit order, from the database's log.

## How it works

```text
App --writes--> PostgreSQL / MySQL
                     | WAL / binlog (already written for replication and crash recovery)
                     v
               CDC connector (Debezium, DMS, DynamoDB Streams)
                     | change events: {op: "u", table: "orders", before: {...}, after: {...}, lsn: ...}
                     v
                   Kafka topics (one per table, keyed by primary key)
           +---------+-----------+-------------+
           v         v           v             v
     Cache invalidator  Search indexer  Warehouse loader  Other services
```

- **Log-based CDC** reads the write-ahead log (PostgreSQL logical replication), binlog (MySQL row-based), oplog (MongoDB), or built-in streams (DynamoDB Streams, Spanner change streams). Low overhead, captures every change including deletes, preserves order.
- **Query-based CDC** polls `WHERE updated_at > last_seen`. Simple, but misses hard deletes, adds load, and can miss rows with equal timestamps.
- **Trigger-based CDC** writes changes to a shadow table via triggers. Captures everything but slows every write.

Log-based is the default recommendation.

## Event contents

Each change event usually carries the operation (create, update, delete), the before and after images of the row, the source position (LSN or binlog offset), the transaction ID, and a timestamp. Keying Kafka messages by primary key preserves per-row order within a partition.

## Initial snapshot

A new consumer needs existing data, not just new changes. Connectors take a consistent snapshot of the tables, then continue streaming from the log position at which the snapshot was taken, so nothing is missed or duplicated beyond at-least-once semantics.

## Common uses

| Use | How |
|---|---|
| Cache invalidation | Consumer deletes keys for changed rows |
| Search indexing | Consumer upserts documents into Elasticsearch |
| Analytics | Stream into a warehouse or lakehouse table with low latency |
| Transactional outbox relay | Capture inserts into an outbox table and publish them as domain events |
| Microservice data sharing | Other services build local read models |
| Migrations | Keep a new datastore in sync with the old one, then cut over |
| Audit trails | Archive every change |

## Raw change events vs domain events

CDC on internal tables exposes your schema to every consumer: a column rename becomes a breaking change for other teams. For cross-team integration, prefer the **outbox pattern** (CDC on an outbox table containing deliberately designed domain events) and keep raw table CDC for internal derived views like caches and search.

## Operational concerns

- **Log retention**: if the connector stops, the database must retain log segments until it catches up. In PostgreSQL, an abandoned replication slot can fill the disk; monitor slot lag.
- **Schema changes**: use a schema registry and compatible evolution.
- **Ordering**: guaranteed per key (partition), not globally across tables.
- **Delivery**: at-least-once; consumers must be idempotent (upserts by primary key are naturally idempotent; compare log positions to drop stale updates).
- **Large transactions** can produce bursts; size consumers for peaks.

## Common mistakes

- Dual-writing to the database and Kafka from application code instead of using CDC or an outbox.
- Exposing internal table schemas as a public contract.
- Forgetting to monitor replication slot lag until the primary's disk fills.
- Query-based polling for data that has hard deletes.

## In the interview

**Q: How do you keep Elasticsearch in sync with your product database?**
Log-based CDC from the database into Kafka, keyed by product ID, with an indexer that upserts or deletes documents idempotently. Bootstrap with a snapshot, and rebuild by replaying into a new index behind an alias.

**Q: Why not just write to both systems in the application?**
The two writes can partially fail, leaving them inconsistent, and changes made outside that code path are missed. CDC reads the committed truth.

**Q: What happens if the CDC consumer is down for an hour?**
Events accumulate in Kafka (or the database log if the connector is down); when it returns, it resumes from its last committed offset. Ensure retention covers the outage and alert on lag.

## Key takeaways

- CDC streams committed changes from the database log, in order, including deletes.
- It eliminates dual writes for caches, search, analytics, and outbox relays.
- Use outbox tables for cross-team domain events; raw CDC for internal derived data.
- Monitor log retention and lag; make consumers idempotent.
