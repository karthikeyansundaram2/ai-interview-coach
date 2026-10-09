Consistent hashing places both servers and keys on a circle so that adding or removing a server moves only the keys next to it, not almost all of them. It is the backbone of distributed caches, Dynamo-style databases, and sticky load balancing.

## The analogy

Imagine a round table with seats for guests (keys) and waiters (servers) spaced around it. Each guest is served by the next waiter clockwise. If a new waiter sits down, only the guests between them and the previous waiter switch over; everyone else keeps their waiter. Compare that with numbering waiters 1 to N and assigning guest k to waiter k mod N: adding one waiter reshuffles nearly every guest.

## The problem with mod N

With `server = hash(key) mod N`, going from 4 to 5 servers changes the assignment of about 80% of keys. For a cache, that means an 80% miss storm hitting the database at once. For a datastore, it means moving most of the data.

## How the ring works

```text
              0
         S3 .   . kA
       .          .
  kD  .            .  S1
      .            .
       .          .   kB
         S2 .   . 
            kC
           2^32

Each key goes to the first server clockwise:
kA -> S1, kB -> S2, kC -> S2, kD -> S3
```

1. Hash each server's identifier onto a ring of size 2^32 (or 2^64).
2. Hash each key onto the same ring.
3. A key belongs to the first server found moving clockwise.
4. Adding a server takes over only the keys between it and its predecessor. On average, only K/N keys move.
5. Removing a server hands its keys to its successor.

Lookups use a sorted array of server positions and a binary search: O(log N).

## Virtual nodes

With few servers, random placement leaves uneven arcs: one server might own 40% of the ring. And when a server dies, its whole load lands on one neighbour.

**Virtual nodes** fix both: each physical server is hashed to many points (100–256 is common), e.g. `S1#0, S1#1, …`.

- Load evens out statistically across servers.
- A failed server's keys spread across many neighbours rather than one.
- Heterogeneous hardware is easy: a server with twice the capacity gets twice the virtual nodes.

## Replication on the ring

Dynamo-style systems store each key on the first N distinct physical servers clockwise (the preference list). Reads and writes then use quorums over those N replicas. Skipping virtual nodes that belong to the same physical server, and ideally the same rack or zone, keeps replicas in separate failure domains.

## Variants

| Technique | Idea | Notes |
|---|---|---|
| Ring with virtual nodes | Classic approach | Cassandra, Dynamo, many caches |
| Rendezvous (highest random weight) hashing | For each key, score every server with hash(key, server) and pick the highest | No ring; O(N) per lookup; elegant for small N |
| Jump consistent hash | Fast arithmetic mapping to buckets 0..N-1 | Tiny memory, but only supports adding/removing at the end |
| Bounded-load consistent hashing | Cap each server at (1 + ε) × average; overflow goes to the next server | Prevents hot-server overload in balancers |
| Fixed partitions (e.g. 1024 slots) | Hash to slot, map slots to nodes | Redis Cluster uses 16,384 hash slots |

## Where it is used

- Distributed caches (client libraries for Memcached, Redis Cluster's slots).
- Partitioned databases (Cassandra, DynamoDB, Riak).
- Load balancers needing affinity (Maglev, Envoy ring hash).
- Sharded message routing (which gateway owns which user).

## Common mistakes

- Too few virtual nodes, leaving visibly uneven load.
- Forgetting that consistent hashing balances keys, not traffic; a single hot key still overloads one server.
- Placing replicas on virtual nodes of the same physical machine.
- Not accounting for data movement bandwidth when adding a node to a large cluster.

## In the interview

**Q: Why consistent hashing instead of hash mod N?**
Resizing the cluster with mod N remaps almost every key, causing a cache miss storm or a massive data migration. With consistent hashing only about 1/N of keys move.

**Q: What are virtual nodes for?**
They smooth out uneven key distribution, spread a failed node's load across many servers, and allow weighting servers by capacity.

**Q: Does consistent hashing solve hot keys?**
No. It spreads many keys evenly but a single popular key still maps to one server. You need caching, key replication, or bounded-load variants for that.

## Key takeaways

- Consistent hashing moves only about K/N keys when membership changes.
- Virtual nodes give even distribution and graceful failure handling.
- Replicas go to the next distinct physical nodes on the ring.
- Fixed hash slots are a practical variant used by many real systems.
