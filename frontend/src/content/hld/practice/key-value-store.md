Designing a distributed key-value store means building something like Dynamo or Cassandra: a simple `get`/`put` interface on top of partitioning, replication, failure detection, and conflict handling. It is a tour of nearly every distributed-systems concept in one problem.

## Clarify requirements

**Functional**
- `put(key, value)`, `get(key)`, `delete(key)`.
- Keys up to 256 B, values up to 1 MB (typically ~1 KB).
- Optional per-key TTL.
- Tunable consistency per request.

**Non-functional**
- Highly available for writes and reads, even during node failures and partitions (AP leaning, as for a shopping cart or session store).
- Scales horizontally to hundreds of nodes, petabytes, millions of ops/s.
- Low latency: p99 < 10 ms within a region.
- Durable: acknowledged writes survive node failure.
- Automatic recovery and rebalancing.

## Back-of-the-envelope

- Target: 1M ops/s (70% reads), 10B keys × 1 KB = **10 TB** of data; ×3 replication = **30 TB**.
- Per node: ~1–2 TB usable SSD and ~20k–50k ops/s → ~30 nodes for storage, ~60–100 nodes for throughput with headroom. Throughput dominates here.
- Each write touches N=3 replicas → 900k replica writes/s cluster-wide.

## API

```text
put(key, value, context?, consistency=QUORUM) -> { ok, version_context }
get(key, consistency=QUORUM) -> { values[], context }    // multiple values if concurrent siblings exist
delete(key, context?) -> ok                              // writes a tombstone
```

`context` carries version information (vector clock) so a client can resolve conflicts and write back a merged value.

## Data model

```text
On each node (LSM storage engine, e.g. RocksDB):
  key -> { value, version (vector clock or timestamp), ttl, tombstone flag }

Cluster metadata (gossiped):
  ring: virtual node tokens -> physical node
  membership: node -> status (up/down/joining/leaving), heartbeat counter
```

## High-level design

```text
            Client
              |  (any node, or a token-aware client routes directly)
              v
     +-------------------+         consistent hashing ring (virtual nodes)
     | Coordinator node  | ------>  key K -> preference list [A, B, C]
     +--+-------+-----+--+
        |       |     |
        v       v     v
      Node A  Node B  Node C        (replicas in different racks/AZs)
       |
     each node: request handler + commit log (WAL) + memtable + SSTables
                + gossip + failure detector + anti-entropy (Merkle trees)
```

**Write path**: the coordinator hashes the key, finds the N replicas on the ring, sends the write to all, and acknowledges after W replicas confirm (each appends to its commit log and memtable).

**Read path**: the coordinator queries R replicas, returns the newest value (or siblings if versions conflict), and triggers read repair on stale replicas.

## Deep dives

### 1. Partitioning and replication

- **Consistent hashing with virtual nodes** (e.g., 256 per physical node) spreads keys evenly and lets a failed node's load spread across many peers. Adding a node moves only ~1/N of the data.
- **Replication**: each key is stored on the first N distinct physical nodes clockwise, chosen to span racks/availability zones.
- **Quorums**: N=3, W=2, R=2 gives W + R > N, so reads overlap the latest write in normal operation. W=1 favours write latency and availability; R=1 favours read latency. Clients choose per request.

### 2. Handling failures

- **Failure detection via gossip**: every second, each node exchanges heartbeat counters with a few random peers; a node whose counter hasn't advanced for a timeout is suspected down. No central coordinator.
- **Sloppy quorum and hinted handoff**: if replica C is down, the coordinator writes to the next healthy node D with a hint "this belongs to C". When C returns, D hands the data back. Writes stay available.
- **Anti-entropy**: replicas periodically compare Merkle trees (hash trees over key ranges); only differing ranges are exchanged, making repair efficient for permanent divergence.
- **Read repair**: stale replicas noticed during reads are updated in the background.
- **Permanent node loss**: replace the node and stream its ranges from the remaining replicas.

### 3. Conflict resolution

Because writes are accepted during partitions on different replicas, concurrent versions can exist.

| Approach | How | Trade-off |
|---|---|---|
| Last-writer-wins (timestamps) | Highest timestamp wins | Simple; silently loses concurrent updates; depends on clocks |
| Vector clocks | Each version tracks (node, counter) pairs; concurrent versions returned as siblings | No silent loss; client must merge |
| CRDTs | Data types that merge automatically (counters, sets) | Only for supported types |

For a shopping cart, vector clocks with a union merge preserve every added item. For session data, LWW is fine. Many production systems (Cassandra) default to LWW per column for simplicity.

### 4. Storage engine

Use an LSM tree: sequential commit log for durability, memtable for recent writes, flushed to immutable SSTables, compacted in the background. Bloom filters per SSTable avoid needless disk reads on gets. Deletes are tombstones kept until after anti-entropy has propagated them (gc grace period), otherwise deleted data can "resurrect" from a stale replica. TTLs expire during compaction.

## Bottlenecks & scaling

- **Hot keys**: consistent hashing doesn't spread a single hot key; use client-side caching or key salting at the application level.
- **Large partitions/values**: enforce value size limits; very large values belong in object storage with a pointer.
- **Compaction overhead**: tune strategy (size-tiered for writes, leveled for reads) and throttle to avoid latency spikes.
- **Rebalancing**: stream data for new nodes at a controlled rate.
- **Multi-datacenter**: replicate across DCs with per-DC quorum options (LOCAL_QUORUM) to keep latency local.

## Follow-ups the interviewer may ask

- **How would you make it strongly consistent?** Use a consensus group (Raft) per partition with a leader handling writes and linearizable reads: CP instead of AP, with higher write latency.
- **What does W + R > N not guarantee?** With sloppy quorums, hinted writes may land outside the preference list, so overlap isn't guaranteed; and concurrent writes still need conflict resolution.
- **How do you add a node?** It takes ownership of some virtual node tokens; existing owners stream those ranges to it; the ring is updated via gossip.
- **How do clients find the right node?** Either any node acts as coordinator, or token-aware clients fetch the ring and route directly, saving a hop.
- **How do you support range scans?** Use an order-preserving partitioner (range partitioning) at the cost of hot spots, or a secondary sorted structure within each partition (Cassandra clustering columns).
