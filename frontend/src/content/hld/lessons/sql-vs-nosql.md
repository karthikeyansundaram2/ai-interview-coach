Choosing a database is choosing which questions will be cheap to ask later. Relational databases give you flexible queries and strong transactions; NoSQL families give up some of that for easier horizontal scale or a data model that matches a specific access pattern.

## The analogy

A relational database is a well-organized office with filing cabinets, cross-referenced folders, and a clerk who can answer any question you think of, as long as the office fits in one building. A key-value store is a wall of numbered lockers: lightning fast if you know the locker number, useless if you want "all lockers containing red items".

## The families

| Type | Model | Examples | Strengths | Weaknesses |
|---|---|---|---|---|
| Relational | Tables, rows, joins, SQL | PostgreSQL, MySQL, Aurora | ACID transactions, ad-hoc queries, constraints | Horizontal write scaling needs sharding |
| Key-value | Key to opaque value | Redis, DynamoDB (core), Memcached | Predictable O(1) access, massive scale | Only queries by key |
| Document | JSON-like documents | MongoDB, Firestore, DynamoDB items | Flexible schema, data that is read together stored together | Cross-document joins and transactions are limited or costly |
| Wide-column | Partition key + sorted clustering columns | Cassandra, ScyllaDB, Bigtable, HBase | Huge write throughput, time-ordered data | Queries must match the key design |
| Graph | Nodes and edges | Neo4j, Neptune | Multi-hop relationship queries | Harder to scale, niche |
| Time-series | Timestamped points | InfluxDB, TimescaleDB, Prometheus | Compression, downsampling | Specialized |
| Search | Inverted index | Elasticsearch, OpenSearch | Full-text and faceted search | Not a primary store |

## How to decide

Ask these questions in order:

1. **Do I need multi-row transactions and constraints?** Money, inventory, bookings: start relational.
2. **What are the access patterns?** If every read is "get by ID" or "get items for partition X sorted by time", a key-value or wide-column store fits perfectly. If product managers will ask new questions weekly, keep SQL.
3. **What is the scale?** A single PostgreSQL primary on modern hardware handles terabytes and thousands of writes per second. Many systems never outgrow it.
4. **What is the write pattern?** Append-heavy, high-volume writes (events, messages, metrics) suit LSM-based stores like Cassandra.
5. **What does the team know how to operate?**

## Modelling differences

Relational modelling normalizes first and queries flexibly. NoSQL modelling starts from queries and denormalizes so each one is a single lookup.

```text
Query: "latest 50 messages in conversation C"

Relational:  messages(id, conversation_id, sender_id, body, created_at)
             INDEX (conversation_id, created_at DESC)

Wide-column: PRIMARY KEY ((conversation_id), created_at DESC, message_id)
             -> one partition read, already sorted

DynamoDB:    PK = CONV#C   SK = MSG#<timestamp>#<id>
```

## Scaling characteristics

| | Relational | Typical NoSQL (Dynamo-style / Cassandra) |
|---|---|---|
| Reads | Replicas | Partitioned + replicas |
| Writes | One primary per shard | All nodes accept writes for their partitions |
| Rebalancing | Manual or via tools (Vitess, Citus) | Built in |
| Consistency | Strong on primary | Tunable, often eventual by default |
| Joins | Native | Done in application or by denormalizing |

Note that the lines have blurred: NewSQL systems (Spanner, CockroachDB, YugabyteDB) offer SQL with automatic sharding and strong consistency, and DynamoDB and MongoDB offer transactions.

## Polyglot persistence

Large systems use several stores: PostgreSQL for orders, Redis for sessions and caching, Cassandra for messages, Elasticsearch for search, S3 for media, and a warehouse for analytics. Each store gets data shaped for its queries, usually kept in sync via events or CDC.

## Common mistakes

- Picking NoSQL "for scale" at a size a single Postgres instance handles easily.
- Designing a DynamoDB or Cassandra table before listing the access patterns.
- Storing large blobs (images, files) in the database instead of object storage.
- Choosing a document store, then needing joins and transactions everywhere.

## In the interview

**Q: Which database for a chat application's messages?**
A wide-column store like Cassandra or a key-value store like DynamoDB, partitioned by conversation and sorted by time. Writes are heavy and append-only, and the dominant query is "recent messages in a conversation".

**Q: Why not use NoSQL for a payments ledger?**
Ledgers need multi-row atomicity, strict constraints, and auditable consistency, which relational databases provide natively. You can scale them with sharding by account.

**Q: When would you choose a NewSQL database?**
When you need relational semantics and strong consistency across a dataset too big or too geographically spread for one primary, and can accept higher write latency from consensus.

## Key takeaways

- Start from access patterns and transaction needs, not from hype.
- Relational gives flexibility and ACID; NoSQL gives predictable scale for known queries.
- NoSQL schemas are designed query-first and denormalized.
- Mixing stores, each for its strength, is normal in large systems.
