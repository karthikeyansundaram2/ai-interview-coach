The CAP theorem is the most quoted and most misquoted idea in system design. Stated carefully, it says that when the network splits your nodes apart, you must choose between answering correctly and answering at all; PACELC adds that even when the network is fine, you are trading consistency against latency.

## The analogy

Two bank branches share account balances by phone. One day the phone line is cut (a partition). A customer at branch A wants to withdraw. Branch A can refuse until the line is restored (consistent, not available), or allow it based on its possibly outdated copy (available, possibly inconsistent). On normal days, branch A could also call branch B before every withdrawal (consistent but slow) or just use its local copy (fast but slightly stale). That second choice is the "ELC" in PACELC.

## CAP, precisely

- **Consistency (C)**: here it means linearizability: every read sees the most recent completed write, as if there were one copy.
- **Availability (A)**: every request to a non-failed node gets a non-error response.
- **Partition tolerance (P)**: the system keeps operating despite messages between nodes being lost.

In a distributed system, partitions are not optional; networks do fail. So the real choice is what to give up **during a partition**:

- **CP**: refuse or block some requests to avoid returning stale or conflicting data. Examples: ZooKeeper, etcd, HBase, Spanner, a single-leader database that rejects writes on the minority side.
- **AP**: keep serving on both sides and reconcile later. Examples: Cassandra and DynamoDB with eventual reads, DNS, shopping carts that merge.

```text
        Partition!
 [Node A] --X-- [Node B]
 client writes x=2 to A
 client reads x from B
   CP: B refuses (or times out)          -> correct but unavailable
   AP: B returns x=1 (stale)              -> available but inconsistent
```

## What CAP does not say

- It does not mean you "pick two of three" at design time; without partitions you can have both C and A.
- It is about one specific, strong definition of consistency. Weaker models (causal, read-your-writes) can remain available during partitions.
- It says nothing about latency, which is what you actually feel day to day.
- Systems are not purely CP or AP; many let you choose per request (DynamoDB strongly consistent reads, Cassandra consistency levels).

## PACELC

**If Partition, choose Availability or Consistency; Else, choose Latency or Consistency.**

Even without failures, strong consistency requires coordination: waiting for a quorum, a leader, or a cross-region round trip. That costs latency.

| System | During partition (PA/PC) | Normal operation (EL/EC) |
|---|---|---|
| Cassandra, DynamoDB (default) | PA | EL (fast, eventually consistent) |
| MongoDB (majority writes/reads) | PC | EC |
| Spanner, CockroachDB | PC | EC (pays latency for consensus) |
| PostgreSQL with async replicas | PC on primary | EL if reading replicas |

## Making the choice per feature

The right answer depends on the cost of being wrong versus the cost of being unavailable:

| Feature | Prefer | Reason |
|---|---|---|
| Bank balance debit, seat booking, inventory decrement | Consistency | Double spending or overselling is expensive |
| Social likes count, view counts | Availability/latency | Off-by-a-few for seconds is harmless |
| Shopping cart | Availability, merge on conflict | Losing an add-to-cart costs sales |
| Username uniqueness | Consistency | Duplicates are a real bug |
| Feed contents | Availability | Stale feed is fine |

Many systems mix: a CP core (payments, inventory) with AP edges (feeds, analytics, caches).

## Common mistakes

- Saying "we choose CA". In a distributed system you cannot opt out of partitions.
- Using CAP to describe eventual consistency in general rather than behaviour during partitions.
- Labelling a whole product "AP" when different operations need different guarantees.
- Ignoring the latency cost of strong consistency across regions (often 50–150 ms per write).

## In the interview

**Q: Is your design CP or AP?**
Answer per data type. For example: "Bookings are CP: a single-leader store per event with conditional writes, rejecting writes if the leader is unreachable. Search and recommendations are AP and can serve stale results."

**Q: Why does strong consistency hurt latency even without failures?**
Each write must be acknowledged by a quorum or leader, sometimes in other zones or regions, before it is visible, and strongly consistent reads may need to contact the leader. That coordination is the "else latency" trade-off.

**Q: How can an AP system avoid losing data on conflicts?**
Track versions (vector clocks or version numbers) and merge with application rules or CRDTs instead of silent last-writer-wins.

## Key takeaways

- CAP is about behaviour during a network partition: consistency or availability.
- The C in CAP means linearizability, not "data is correct" in general.
- PACELC adds the everyday trade-off between latency and consistency.
- Choose per operation based on the business cost of staleness versus downtime.
