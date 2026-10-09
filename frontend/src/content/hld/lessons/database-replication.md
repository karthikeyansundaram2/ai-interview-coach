Replication keeps copies of the same data on several machines so you can survive failures, serve more reads, and put data closer to users. The hard part is not copying the data; it is deciding what happens when copies disagree.

## The analogy

A head chef writes the official recipe book, and line cooks keep photocopies at their stations. Cooks read from their copies, but only the head chef changes recipes, and copies are updated a little later (leader-follower). If several chefs in different kitchens each edit recipes, you must decide whose change wins when they conflict (multi-leader). If any chef can edit and you check several copies to find the latest (leaderless), you need a voting rule.

## Leader-follower (primary-replica)

```text
            writes
 App ------------------> Leader
  |                        | replication stream (WAL/binlog)
  | reads           +------+------+
  +---------------> Follower 1   Follower 2
```

- All writes go to the leader, which streams changes to followers.
- Reads can go to followers to scale read throughput.
- On leader failure, a follower is promoted (failover).

**Synchronous vs asynchronous replication**:

| Mode | Durability | Write latency | Availability |
|---|---|---|---|
| Synchronous (wait for all followers) | No data loss | Highest | Any slow follower stalls writes |
| Semi-synchronous (wait for one) | Survives leader loss | Moderate | Common compromise |
| Asynchronous | May lose recent writes on failover | Lowest | Highest |

## Replication lag and its anomalies

With asynchronous followers, lag is usually milliseconds but can be seconds under load. That produces visible bugs:

- **Read-your-writes violation**: a user updates their profile, refreshes, and sees the old value from a lagging replica. Fix: route that user's reads to the leader for a short time after a write, or read from a replica only once it has caught up to the user's last write position.
- **Monotonic reads violation**: two refreshes hit different replicas and data appears to go backwards. Fix: pin a user's session to one replica.
- **Consistent prefix violation**: an answer appears before its question across partitions. Fix: keep causally related writes in the same partition.

## Failover pitfalls

- **Data loss**: an async follower promoted to leader may lack the old leader's last writes.
- **Split brain**: the old leader comes back and still thinks it is leader. Use fencing (epoch numbers) and a consensus-based coordinator to decide leadership.
- **Detection time**: too aggressive a timeout causes unnecessary failovers; too lax prolongs outages. Typical managed databases fail over in 30–120 seconds.

## Multi-leader

Each region (or datacenter) has its own leader accepting writes; leaders replicate to each other asynchronously.

- Low write latency for users in every region and tolerance of regional outages.
- **Write conflicts** are inevitable: two regions update the same row concurrently. Resolution options include last-writer-wins (simple, loses data), merging (CRDTs), or application-specific rules.
- Best when conflicts are rare by design, for example each user's data is mostly written in their home region.

## Leaderless (Dynamo-style)

Clients write to several replicas and read from several replicas; quorum rules ensure overlap.

```text
N = replicas, W = write acks required, R = replicas read
If W + R > N, a read overlaps at least one replica with the latest write.
Common: N=3, W=2, R=2
```

Missing writes are repaired by **read repair** (fix stale replicas noticed during reads) and **anti-entropy** (background Merkle-tree comparison). **Hinted handoff** lets another node temporarily accept writes for a down node. Used by Cassandra, Riak, and DynamoDB internally.

## Comparison

| | Leader-follower | Multi-leader | Leaderless |
|---|---|---|---|
| Write scaling | One leader | One per region | All replicas |
| Conflicts | None | Yes | Yes (versioning needed) |
| Consistency | Strong at leader | Eventual across regions | Tunable via quorums |
| Complexity | Low | High | Medium-high |

## Common mistakes

- Sending reads to replicas without handling read-your-writes.
- Assuming failover is lossless with asynchronous replication.
- Using last-writer-wins with unsynchronized clocks and silently dropping updates.
- Forgetting that replicas multiply storage and write bandwidth.

## In the interview

**Q: A user edits their bio and the old one shows on refresh. Why, and how do you fix it?**
The read hit a lagging replica. Route that user's reads to the primary for a few seconds after a write, or track their last write's log position and only read from replicas that have applied it.

**Q: Synchronous or asynchronous replication for a payment database?**
At least semi-synchronous, so a committed payment survives losing the primary. The extra milliseconds are worth zero data loss.

**Q: What does W + R > N guarantee?**
Every read quorum intersects every write quorum, so at least one replica in the read set has the latest acknowledged write. It does not by itself guarantee linearizability under concurrent writes or failures.

## Key takeaways

- Leader-follower is the default: simple, scales reads, needs careful failover.
- Asynchronous lag causes read-your-writes and monotonic-read anomalies.
- Multi-leader and leaderless designs scale writes but must resolve conflicts.
- Quorums (W + R > N) trade latency for consistency on a per-request basis.
