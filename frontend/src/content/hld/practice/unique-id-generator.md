Every large system needs IDs for posts, orders, and messages that are unique across many machines and data centers. The interesting part is producing them at high rates without a central bottleneck, while keeping them compact and roughly sorted by time.

## Clarify requirements

**Functional**
- `nextId()` returns a unique ID.
- IDs are 64-bit integers (fit in `BIGINT`, compact in indexes).
- IDs are roughly ordered by creation time (k-sortable), so sorting by ID ≈ sorting by time.
- Optionally, extract the creation timestamp from an ID.

**Non-functional**
- 1M+ IDs per second across the fleet; generation latency under 1 ms (ideally in-process).
- Highly available: ID generation must never be the reason writes fail.
- Works across multiple data centers.
- No duplicates, ever, including across restarts and clock adjustments.

## Back-of-the-envelope

- 1M IDs/s across, say, 200 application servers → 5k IDs/s per server.
- 64 bits budget: a millisecond timestamp needs 41 bits for ~69 years (2^41 ms ≈ 69.7 years).
- Remaining 22 bits: 10 bits for worker ID (1,024 workers) and 12 bits for sequence (4,096 IDs per ms per worker → ~4M IDs/s per worker). Plenty of headroom.
- Coordination: only needed to assign worker IDs (once per process start), not per ID.

## API

```text
In-process library (preferred):
  long nextId()
  long[] nextIds(n)
  Instant timestampOf(long id)

Or as a service (for languages without the library):
  GET /v1/ids?count=100  ->  { "ids": [ ... ] }
```

A library avoids a network hop per ID; a service is easier to roll out across many languages but must be highly available and batch-friendly.

## Data model

There is no per-ID storage. The only persistent state is worker ID assignment:

```text
worker_leases (etcd / ZooKeeper / DynamoDB with TTL)
  worker_id    0..1023 (PK)
  holder       host/pod identity
  lease_expiry
  last_timestamp_ms  (optional: highest timestamp issued, used on restart)
```

ID layout:

```text
 0 | 41 bits timestamp (ms since custom epoch, e.g. 2024-01-01) | 5 bits DC | 5 bits machine | 12 bits sequence
```

## High-level design

```text
 +-------------------+        acquire/renew lease          +----------------------+
 | App server (pod)  | ----------------------------------> | Coordination store   |
 |  IdGenerator      |   worker_id = 317 (lease, 30 s)     | (etcd / ZooKeeper)   |
 |   - worker_id     | <---------------------------------- +----------------------+
 |   - last_ts       |
 |   - sequence      |  nextId(): local, lock-free/atomic, no network
 +-------------------+
```

Generation algorithm:

```text
ts = now_ms()
if ts < last_ts:          # clock moved backwards
    handle_rollback()
if ts == last_ts:
    seq = (seq + 1) & 0xFFF
    if seq == 0: ts = wait_until_next_ms(last_ts)
else:
    seq = 0
last_ts = ts
return ((ts - EPOCH) << 22) | (worker_id << 12) | seq
```

On startup, a process acquires a free worker ID via a lease (compare-and-set in etcd), renews it periodically, and stops issuing IDs if it cannot renew before expiry.

## Deep dives

### 1. Assigning worker IDs safely

Two processes with the same worker ID will produce duplicates in the same millisecond. Options:

| Approach | Pros | Cons |
|---|---|---|
| Static config per host | Simple | Breaks with autoscaling, manual errors |
| Kubernetes StatefulSet ordinal | Stable, automatic | Only for stateful sets; combine with DC bits |
| Lease from etcd/ZooKeeper | Safe with autoscaling | Dependency at startup only |
| Derive from IP/MAC bits | No coordination | Collisions are possible; risky |

Leases are the robust choice. If a process is paused past its lease (GC pause), it must detect lease loss before issuing more IDs; checking the lease expiry locally before each batch guards against this. The coordination store is only on the startup and renewal path, so its brief unavailability doesn't stop generation.

### 2. Clock rollback

NTP may step the clock backwards. If we keep issuing IDs, we may repeat a (timestamp, sequence) pair already used.

- **Small rollback (a few ms)**: wait until the clock passes `last_ts`.
- **Moderate**: continue using `last_ts` as the timestamp and keep incrementing the sequence (a "logical clock"); this works until the sequence is exhausted.
- **Large**: refuse to generate, alert, and take the instance out of rotation.
- Configure NTP to slew (adjust gradually) rather than step, and persist `last_ts` periodically so a restarted process with a skewed clock doesn't reuse old timestamps.

### 3. Alternatives and when to prefer them

- **UUID v7 / ULID**: 128-bit, time-ordered, no worker coordination at all. Prefer when 128 bits is acceptable; it removes the hardest operational part.
- **Database ticket server**: `REPLACE INTO tickets` with auto-increment, or two servers with odd/even offsets. Strict ordering but a central dependency per ID (or per batch).
- **Range allocation**: fetch blocks of 1,000 sequential IDs from a central counter. Compact and nearly ordered; the allocator is a small dependency.

### 4. Ordering guarantees

IDs from one worker are strictly increasing. Across workers they are ordered only to within clock skew (often a few ms) — fine for feeds and pagination, but not a substitute for a true total order (use a sequencer or consensus log when that is required).

## Bottlenecks & scaling

- Per-worker throughput is 4,096 IDs/ms; a process exceeding that waits for the next millisecond. Shard by adding workers.
- 1,024 workers can be limiting in large fleets; rebalance bits (e.g., 12 bits worker, 10 bits sequence) based on fleet size versus per-worker rate.
- The coordination store sees only lease traffic (a few hundred renewals per minute).
- 41-bit timestamps last ~69 years from the custom epoch; pick a recent epoch.

## Follow-ups the interviewer may ask

- **Can IDs leak business information?** Yes, creation time and rough volume. Expose an opaque, encrypted, or random public identifier if that matters.
- **How do you make IDs unguessable?** Snowflake IDs are guessable. Use random 128-bit tokens for public URLs, or encrypt the 64-bit ID with a format-preserving cipher.
- **What about multiple data centers?** Reserve datacenter bits in the worker ID so leases are allocated per DC, avoiding cross-DC coordination.
- **What if the sequence overflows?** Block until the next millisecond; at 4M/s per worker this is rare and short.
- **Why not just use the database's auto-increment?** It couples ID generation to one database's availability and throughput, and breaks once data is sharded.
