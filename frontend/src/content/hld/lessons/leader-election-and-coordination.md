Many systems need exactly one node doing something at a time: one scheduler firing jobs, one primary accepting writes, one worker owning a partition. Leader election and distributed locks provide that, but only if you handle the moment when an old leader does not know it has been replaced.

## The analogy

A shared office car has one key on a hook. Whoever takes the key drives; everyone else waits. To stop someone keeping the key forever, the key is only valid for an hour and must be re-signed to keep using it (a lease). And to stop a driver whose hour expired from returning and parking in the reserved spot, every key carries an increasing number, and the garage only accepts the newest number it has seen (a fencing token).

## Why you need a coordination service

You could try to elect a leader with a simple database row or Redis key, and for low-stakes tasks that can be fine. But correctness under crashes, pauses, and partitions requires a linearizable store, which is what **ZooKeeper**, **etcd**, and **Consul** provide via consensus. They offer:

- Linearizable compare-and-set on small keys.
- **Leases / sessions** tied to client heartbeats: if a client dies, its keys disappear.
- **Watches**: get notified when a key changes (for example, the leader key is deleted).
- Ordered or sequential keys for queues and fair locks.

## Leader election recipe

```text
1. Each candidate tries: CREATE /election/leader (ephemeral, with lease) value=node-id
2. The one that succeeds is leader; it renews its lease every few seconds.
3. Others WATCH the key.
4. Leader crashes -> lease expires -> key deleted -> watchers race to create it.
```

In ZooKeeper, candidates create ephemeral sequential nodes and the lowest sequence number wins; each candidate watches only its predecessor, avoiding a herd of watchers waking up at once.

In Kubernetes, controllers use a **Lease** object (backed by etcd) with a holder identity and renew time.

## The zombie leader problem

A leader can be paused (a long garbage-collection pause, a VM migration, a network partition) longer than its lease. Meanwhile a new leader is elected. When the old one wakes, it still believes it is leader and may write.

```text
t0  Node A acquires lease (10 s), token 33
t1  A pauses (GC) for 15 s
t11 lease expires; Node B acquires lease, token 34, writes to storage
t16 A wakes, still thinks it is leader, writes with token 33
    Storage rejects: 33 < 34 already seen   <-- fencing saves you
```

**Fencing tokens**: the coordination service hands out a monotonically increasing number with each lease (etcd revision, ZooKeeper zxid). Every write to the protected resource includes the token, and the resource rejects tokens lower than the highest it has seen. Without fencing, a lease alone cannot guarantee mutual exclusion.

## Redis locks

A single Redis `SET key value NX PX 30000` lock is fine for **efficiency** locks (avoid duplicate work; occasional double execution is harmless). It is not safe for **correctness** locks: failover can lose the key, and there is no fencing. The multi-node Redlock algorithm is debated because it relies on timing assumptions. For correctness, use a consensus-backed store plus fencing, or design the operation itself to be idempotent and conditional.

## Alternatives to a single leader

- **Partitioned ownership**: assign each partition or shard to one worker (via consistent hashing or a lease per partition) so many leaders work in parallel. Kafka consumer groups do this.
- **Conditional writes**: make the underlying operation safe under concurrency (`UPDATE jobs SET owner=? WHERE id=? AND owner IS NULL`) so two would-be leaders cannot both succeed.
- **Idempotent work**: if running twice is harmless, a best-effort lock is enough.

## Common mistakes

- Using a non-replicated Redis lock to protect money or inventory.
- Leases without fencing tokens.
- Lease durations shorter than worst-case pauses, causing constant leader flapping.
- Putting heavy data or high-frequency writes into ZooKeeper or etcd.

## In the interview

**Q: How do you ensure only one scheduler instance triggers jobs?**
Use a leader lease in etcd or ZooKeeper, renewed by heartbeat; standbys watch and take over on expiry. Make job dispatch idempotent and include a fencing token or conditional update so a stale leader cannot double-dispatch.

**Q: Is a Redis lock enough?**
For avoiding duplicate effort, yes. For correctness, no: a failover or long pause can let two holders act. Use consensus-backed leases with fencing, or make the protected operation conditional.

**Q: What is a fencing token?**
A monotonically increasing number issued with each lock grant. The protected resource rejects requests carrying a token lower than one it has already seen, which neutralizes stale lock holders.

## Key takeaways

- Coordination services provide linearizable keys, leases, and watches for election and locks.
- Leases expire automatically, but a paused node can outlive its lease.
- Fencing tokens are what make mutual exclusion safe.
- Prefer partitioned ownership and idempotent operations over a single global lock.
