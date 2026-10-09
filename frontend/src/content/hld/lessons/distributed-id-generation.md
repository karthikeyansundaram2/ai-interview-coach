Once data is sharded, an auto-increment column in one database can no longer hand out IDs. You need IDs that are unique across many machines, generated without a bottleneck, and ideally sortable by time so recent items cluster together in indexes.

## The analogy

A large conference has several registration desks. If they all shared one ticket roll, the line would form at the roll. Instead, each desk gets its own stamp with the date, time, a desk number, and a counter: tickets are unique without desks ever talking to each other, and sorting tickets by number roughly sorts them by arrival time.

## Requirements to clarify

- Uniqueness across all nodes (always).
- Size: 64-bit integer (fits a `BIGINT`, compact in indexes) or 128-bit.
- Roughly time-ordered (helps B-tree locality, pagination, and "latest first" queries)?
- Throughput: thousands or millions per second?
- Must IDs be unguessable (public URLs)?

## Options

**Database auto-increment**: simple, ordered, but one database is a bottleneck and single point of failure. A variant uses multiple databases with different offsets (server 1 issues 1, 3, 5; server 2 issues 2, 4, 6), which is awkward to resize.

**Ticket server / range allocation**: a central service hands out blocks of IDs (for example 1,000 at a time) that each app server consumes locally. Few central calls, IDs roughly ordered, but gaps appear after crashes and the allocator must be highly available.

**UUID v4**: 128 random bits generated anywhere, no coordination. But it is large (16 bytes, 36 as text), random order fragments B-tree indexes (every insert lands on a random page), and it is not sortable.

**UUID v7 / ULID**: 48-bit millisecond timestamp followed by random bits. Still 128-bit and coordination-free, but time-ordered, which fixes index locality. A strong modern default when 128 bits is acceptable.

**Snowflake-style 64-bit IDs**:

```text
| 1 bit | 41 bits                     | 10 bits        | 12 bits       |
| sign  | ms since custom epoch       | machine/worker | sequence      |
|   0   | ~69 years of milliseconds   | 1,024 workers  | 4,096 per ms  |
```

- Each worker generates IDs locally: timestamp, its worker ID, and a per-millisecond counter.
- Capacity: 4,096 IDs per millisecond per worker, about 4M per second per worker.
- Sorting by ID sorts by creation time (across workers, to within clock skew).
- Fits in a 64-bit integer.

## Comparison

| Approach | Size | Ordered | Coordination | Throughput | Weakness |
|---|---|---|---|---|---|
| Auto-increment | 64-bit | Strict | Central DB | Limited | Bottleneck, SPOF |
| Range allocation | 64-bit | Roughly | Occasional | High | Gaps, allocator HA |
| UUID v4 | 128-bit | No | None | Unlimited | Index fragmentation, size |
| UUID v7 / ULID | 128-bit | By time | None | Unlimited | Size |
| Snowflake | 64-bit | By time | Worker ID assignment | ~4M/s per worker | Clock issues |

## Snowflake's hard parts

- **Worker ID assignment**: each generator needs a unique ID among 1,024. Assign via a coordination service (an etcd lease or ZooKeeper sequential node), from a config/deployment ordinal (Kubernetes StatefulSet index), or derived from a datacenter + machine ID split (5 + 5 bits).
- **Clock going backwards**: NTP adjustments can move the clock back. Generating IDs in that window risks duplicates. Options: refuse to generate (wait until the clock catches up), keep using the last timestamp and borrow from the sequence, or treat a large jump as a fatal error and take the node out of rotation.
- **Sequence exhaustion**: if 4,096 IDs are used within a millisecond, wait for the next millisecond.
- **Leaking information**: IDs reveal creation time and approximate volume. For public, unguessable identifiers, expose a separate random token or encode the ID.

## Common mistakes

- Random UUIDs as the clustered primary key on a write-heavy MySQL table.
- Snowflake workers with duplicate worker IDs after an autoscaling event.
- Ignoring clock rollback.
- Assuming time-ordered IDs are strictly ordered across machines; they are only roughly ordered.

## In the interview

**Q: How would you generate IDs for tweets at 100k/s across data centers?**
Snowflake-style 64-bit IDs: timestamp, datacenter and worker bits, and a sequence. Worker IDs are leased from a coordination service. IDs are sortable by time, which the timeline queries use for pagination.

**Q: Why not UUID v4?**
It is twice the size and random, so inserts scatter across the index, causing page splits and poor cache locality. If 128 bits is acceptable, UUID v7 fixes the ordering problem.

**Q: What if a server's clock jumps back by 5 ms?**
Refuse to issue IDs until the clock passes the last used timestamp (a 5 ms wait is fine), or continue on the last timestamp using the sequence bits. Alert on large jumps and pull the node.

## Key takeaways

- Clarify size, ordering, throughput, and guessability before choosing.
- Snowflake gives compact, time-sortable 64-bit IDs without per-ID coordination.
- UUID v7/ULID are coordination-free and time-ordered at 128 bits.
- Handle worker ID assignment and clock rollback explicitly.
