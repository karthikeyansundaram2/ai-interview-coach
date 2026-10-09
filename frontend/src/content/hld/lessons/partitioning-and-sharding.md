When data or write traffic outgrows one machine, you split it into partitions (shards), each owned by a different node. The partition key you choose decides whether load spreads evenly or piles onto one unlucky server.

## The analogy

A big library splits its collection across buildings. Splitting by first letter of the author's surname (A–F in building 1, G–M in building 2) makes "all authors starting with K" easy to find but may overload whichever building has the most popular surnames. Splitting by a shuffled card number spreads books evenly but scatters any one author's works everywhere.

## Partitioning strategies

**Range partitioning**: each shard owns a contiguous key range (`user_id 1–1M`, `1M–2M`, or dates by month).
- Range scans are efficient.
- Prone to hot spots: time-based keys send all new writes to the last shard.

**Hash partitioning**: shard = hash(key) mod N, or a hash range.
- Spreads keys evenly.
- Range queries must hit every shard.
- With naive `mod N`, changing N moves almost every key, so use consistent hashing or a fixed number of virtual partitions.

**Directory (lookup) partitioning**: a service maps keys to shards explicitly.
- Maximum flexibility; you can move single tenants.
- The directory is another critical, cached dependency.

**Geographic partitioning**: users' data lives in their home region, for latency and data-residency laws.

```text
Fixed virtual partitions (e.g. 1024) mapped to nodes:

key --hash--> partition 0..1023 --lookup--> node
 p0-p255 -> node A   p256-p511 -> node B   p512-p767 -> node C   p768-p1023 -> node D
Adding node E: move a few whole partitions, not individual keys.
```

## Choosing a partition key

A good key has high cardinality, distributes load evenly, and keeps data that is queried together on the same shard.

| System | Good key | Why |
|---|---|---|
| Chat messages | conversation_id | A conversation's messages are read together |
| E-commerce orders | user_id or order_id | User history on one shard; order_id for even spread |
| Multi-tenant SaaS | tenant_id | Isolation, easy per-tenant moves; big tenants need sub-sharding |
| Metrics | hash(series_id) + time bucket | Spread writes, bound partition size |

Bad keys: country (a few huge values), status (low cardinality), timestamp alone (monotonic hot spot).

## Hot partitions

Even a good key can have celebrity values. Remedies:

- **Key salting**: append a suffix (`user123#0..9`) to split one hot key across ten partitions; reads must fan out and merge.
- **Splitting**: split a hot range into smaller ranges (automatic in DynamoDB, Bigtable, HBase).
- **Caching** reads for the hot key.
- **Isolating** large tenants onto dedicated shards.

## What sharding breaks

- **Cross-shard queries**: aggregations or secondary-key lookups hit every shard (scatter-gather), with latency set by the slowest shard.
- **Cross-shard transactions**: need 2PC or sagas; design to avoid them.
- **Unique constraints and joins** across shards must be enforced in the application.
- **Secondary indexes**: either local (query all shards) or global (an index partitioned by the indexed field, updated asynchronously).
- **Rebalancing** needs data movement while serving traffic, usually by copying a partition, catching up from the log, then switching ownership.

## When to shard

Sharding adds lasting complexity. Exhaust simpler options first: vertical scaling, read replicas, caching, archiving cold data, and splitting by functional area (separate databases for separate services). Shard when write throughput or data size truly exceeds one primary, which for modern hardware is often several terabytes or tens of thousands of writes per second.

## Common mistakes

- Using `hash mod N` and then needing to add a node.
- Partitioning by a key that does not appear in the common queries, so everything is scatter-gather.
- Monotonic keys on range-partitioned stores.
- Sharding prematurely when a bigger instance would have lasted years.

## In the interview

**Q: How would you shard a table of user posts?**
By user_id (hashed), so a user's posts and profile queries hit one shard. For the home feed, which needs other users' posts, rely on a precomputed feed store rather than cross-shard queries.

**Q: How do you add capacity without downtime?**
Use many fixed virtual partitions mapped to nodes. To add a node, copy selected partitions to it, stream ongoing changes until caught up, then flip the mapping in the routing layer.

**Q: How do you handle a celebrity's data overloading a shard?**
Cache their hot reads aggressively, salt write-heavy keys across sub-partitions, or move the celebrity to a dedicated shard.

## Key takeaways

- Range partitioning favours scans; hash partitioning favours even load.
- Pick a high-cardinality key that matches your dominant queries.
- Use virtual partitions or consistent hashing so rebalancing moves little data.
- Sharding sacrifices joins, cross-shard transactions, and simple global indexes, so delay it until needed.
