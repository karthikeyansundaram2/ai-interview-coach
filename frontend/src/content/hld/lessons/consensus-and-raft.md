Consensus lets a group of machines agree on a sequence of decisions even when some crash, which is the foundation of every reliable coordination service and strongly consistent database. Raft is the consensus algorithm designed to be understandable, and it is the one interviewers expect you to sketch.

## The analogy

A committee keeps official minutes. One member is elected chair; only the chair proposes new entries. An entry becomes official once a majority of members have written it into their copies. If the chair goes silent, the members hold an election, and nobody can become chair without the votes of a majority, so there can never be two chairs whose decisions both count.

## Why consensus

Replicating data is easy; agreeing on order under failures is hard. Consensus provides a **replicated log**: every node applies the same commands in the same order, so they end up in the same state (state machine replication). It tolerates the failure of a minority: a cluster of 2f + 1 nodes survives f failures.

| Cluster size | Majority | Failures tolerated |
|---|---|---|
| 3 | 2 | 1 |
| 5 | 3 | 2 |
| 7 | 4 | 3 |

Even sizes add cost without improving tolerance (4 nodes still tolerate only 1 failure).

## Raft in three parts

### 1. Leader election

Every node is a **follower**, **candidate**, or **leader**. Time is divided into numbered **terms**.

```text
Follower --(no heartbeat within random 150-300 ms timeout)--> Candidate
Candidate: term++, vote for self, RequestVote to all
   majority votes -> Leader (sends heartbeats)
   sees higher term or another leader -> Follower
   split vote -> timeout again (randomized), new term
```

- Each node votes at most once per term, so at most one leader per term.
- A node only votes for a candidate whose log is at least as up to date as its own, which guarantees the new leader has every committed entry.
- Randomized election timeouts make split votes rare.

### 2. Log replication

```text
Client --> Leader: append entry (term 3, index 7) to own log
Leader --> AppendEntries --> Followers write entry, reply OK
Majority have it --> entry COMMITTED --> leader applies it, replies to client
Followers learn commit index in next heartbeat and apply
```

- Followers reject an AppendEntries whose previous entry does not match; the leader backs up and overwrites conflicting, uncommitted entries. Logs converge to the leader's.
- An entry is committed once stored on a majority, so it survives any minority failure.

### 3. Safety

- Election restriction ensures leaders hold all committed entries.
- A leader only counts replicas for entries from its own term when advancing the commit index, avoiding a subtle overwrite case.
- Old leaders that come back with a lower term see the higher term and step down.

## Reads

A leader might be deposed without knowing. Linearizable reads therefore either go through the log, or the leader confirms it still has a majority (a heartbeat round, "read index"), or it relies on time-based leader leases (faster, but depends on bounded clock drift).

## Performance

Every write costs a round trip to a majority plus a durable disk write (fsync). Within one region that is about 1–10 ms; across regions it can be 50–200 ms. Throughput is limited by the single leader, so systems shard data into many Raft groups (CockroachDB, TiKV, YugabyteDB run thousands of groups).

## Where Raft and Paxos appear

- **etcd** (Kubernetes' brain), **Consul**: Raft.
- **ZooKeeper**: ZAB, a similar protocol.
- **Kafka KRaft**: Raft-based metadata quorum replacing ZooKeeper.
- **Spanner, Chubby**: Paxos.
- **CockroachDB, TiKV**: Multi-Raft.

## Common mistakes

- Running two-node or even-sized clusters.
- Spreading a consensus group across distant regions without accepting the write latency.
- Storing large, high-volume data in a coordination service like etcd or ZooKeeper; they are for small, critical metadata.
- Assuming reads from any follower are linearizable.

## In the interview

**Q: Why does Raft need a majority?**
Any two majorities overlap in at least one node, so a newly elected leader always overlaps with the nodes that stored every committed entry, and two leaders cannot both make progress in the same term.

**Q: What happens if the leader crashes?**
Followers stop receiving heartbeats, one times out, becomes a candidate with a higher term, and wins votes from a majority whose logs are not more up to date than its own. Uncommitted entries from the old leader may be discarded; committed ones are never lost.

**Q: How do you scale beyond one leader's throughput?**
Partition the data into many independent Raft groups, each with its own leader spread across nodes.

## Key takeaways

- Consensus gives a fault-tolerant, ordered replicated log.
- Raft = leader election + log replication + safety rules; majorities make it safe.
- 2f + 1 nodes tolerate f failures; use odd cluster sizes.
- Writes cost a majority round trip; scale by sharding into many groups.
