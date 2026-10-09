"Consistent" can mean many things, from "everyone sees the same thing at the same instant" to "everyone eventually agrees". Naming the exact model a feature needs lets you avoid paying for guarantees you do not need, and avoid bugs from guarantees you assumed but do not have.

## The analogy

Consider a group chat. With **linearizability**, everyone sees every message the instant it is sent, in the same order, as if there were one shared screen. With **causal consistency**, a reply never appears before the message it answers, but unrelated messages may appear in different orders on different phones. With **eventual consistency**, everyone ends up with the same history once the network settles, but for a while phones may disagree.

## The spectrum

```text
Stronger, slower, less available                               Weaker, faster, more available
|----------------|---------------|--------------|-----------------|----------------|
Linearizable  Sequential      Causal      Session guarantees     Eventual
(strict)      (one global     (cause      (read-your-writes,
              order)          before      monotonic reads)
                              effect)
```

## The models

**Linearizability (strong consistency)**: every operation appears to happen atomically at a single point in time between its start and end, and all clients agree on that order. Once a write completes, every later read sees it. Needed for locks, leader election, unique constraints, and account balances. Costs coordination (consensus or a single leader).

**Sequential consistency**: all clients see operations in the same order, and each client's operations appear in program order, but that order need not match real time. Rarely exposed directly by databases.

**Causal consistency**: operations that are causally related (a reply to a post, an update after a read) are seen by everyone in cause-then-effect order; concurrent operations may be seen in different orders. It can stay available during partitions, which makes it attractive for collaborative and social features.

**Session guarantees** (client-centric):
- **Read-your-writes**: after I write, my reads reflect it.
- **Monotonic reads**: I never see data go backwards.
- **Monotonic writes**: my writes are applied in the order I issued them.
- **Writes follow reads**: if I read something then write, my write is ordered after what I read.

**Eventual consistency**: if writes stop, all replicas converge. No promise about what you read in the meantime. Cheap, highly available, and fine for counters, feeds, recommendations, and caches.

## Comparison

| Model | Guarantees | Typical implementation | Example use |
|---|---|---|---|
| Linearizable | Real-time single order | Leader + consensus, quorum reads | Locks, inventory, balances |
| Causal | Cause before effect | Version vectors, dependency tracking | Comments, chat, collaboration |
| Read-your-writes | See own writes | Sticky routing, read-from-leader after write | Profile edits, settings |
| Eventual | Convergence | Async replication, anti-entropy | Likes, view counts, DNS |

## Transaction isolation is a separate axis

Consistency models describe single objects across replicas. Isolation levels describe multi-object transactions on one database:

| Isolation | Prevents | Still allows |
|---|---|---|
| Read committed | Dirty reads | Non-repeatable reads, lost updates |
| Repeatable read / snapshot | Non-repeatable reads | Write skew |
| Serializable | All anomalies above | Nothing; costs throughput |

Write skew example: two doctors both check "at least one other doctor is on call" and both go off call. Snapshot isolation allows it; serializable or explicit locking (`SELECT ... FOR UPDATE`) prevents it.

## Practical techniques

- **Read from the leader** for operations needing fresh data, replicas for the rest.
- **Conditional writes / compare-and-set** to make check-then-act atomic.
- **Version tokens**: the client carries the version of its last write; replicas serve the read only if they have caught up.
- **Quorums** (W + R > N) for stronger reads in leaderless stores.

## Common mistakes

- Saying "eventually consistent" without stating how long and what users see meanwhile.
- Assuming a database's default isolation is serializable (it rarely is; PostgreSQL defaults to read committed).
- Using strong consistency everywhere, then fighting latency and availability problems.
- Building check-then-act logic on eventually consistent reads (for example, checking stock on a replica before decrementing).

## In the interview

**Q: What consistency does a "like" counter need?**
Eventual. Seeing 1,203 instead of 1,205 for a few seconds is harmless, so use async aggregation and caching.

**Q: A user changes a setting and the old value appears. Which guarantee is missing?**
Read-your-writes. Fix it by routing that user's reads to the leader for a short window or using version tokens.

**Q: How do you prevent overselling the last ticket?**
Use a linearizable operation: a conditional decrement (`UPDATE ... SET qty = qty - 1 WHERE qty > 0`) on the authoritative store, or a serializable transaction.

## Key takeaways

- Consistency is a spectrum; name the model each feature needs.
- Linearizability costs coordination; eventual consistency costs correctness guarantees.
- Session guarantees fix most user-visible anomalies cheaply.
- Isolation levels are a separate concern; know which anomalies yours allows.
