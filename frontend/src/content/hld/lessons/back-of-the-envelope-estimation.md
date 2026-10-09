Estimation is how you decide whether a design needs one database or a hundred before you draw a single box. Interviewers do not want precision; they want to see that you can turn user counts into QPS, storage, and bandwidth quickly and then let those numbers drive decisions.

## The analogy

Planning a wedding, you do not count individual grains of rice. You say "about 300 guests, roughly 200 grams of food each, so about 60 kg of food and 30 tables of ten". Close enough to book the right hall. Capacity estimation is the same: round aggressively, keep units straight, and make a decision.

## The method

1. **Start from users**: daily active users (DAU) and actions per user per day.
2. **Convert to QPS**: one day is about 86,400 seconds; round to **100,000** (10^5) for easy math.
3. **Apply a peak factor**: peak is often 2–5x average.
4. **Split reads and writes**: most consumer systems are read-heavy, often 10:1 to 100:1.
5. **Storage**: writes per day x size per item x retention.
6. **Bandwidth**: QPS x payload size.
7. **Translate into machines**: divide by realistic per-node capacity.

## Worked example: a photo-sharing app

- 100M DAU, each uploads 0.1 photos/day and views 50 photos/day.
- Writes: 100M x 0.1 = 10M/day, so 10M / 10^5 = **100 uploads/s**, peak ~300/s.
- Reads: 100M x 50 = 5B/day, so **50,000 views/s**, peak ~150k/s.
- Storage: 10M photos x 2 MB = 20 TB/day, about **7 PB/year** before replication.
- Egress: 50k/s x 200 KB (a resized thumbnail) = **10 GB/s**, which says "CDN" loudly.
- Metadata: 10M rows/day x 1 KB = 10 GB/day; small enough for a sharded relational or key-value store.

## Numbers to know

| Quantity | Approximate value |
|---|---|
| L1 cache reference | 1 ns |
| Main memory reference | 100 ns |
| Compress 1 KB (fast codec) | 2 µs |
| Read 1 MB sequentially from memory | 10 µs |
| Round trip within a datacenter | 0.5 ms |
| SSD random read | 100 µs |
| Read 1 MB sequentially from SSD | 0.5–1 ms |
| HDD seek | 5–10 ms |
| Round trip cross-continent | 70–150 ms |
| Redis GET (in-DC, incl. network) | ~0.5–1 ms |
| Well-indexed DB point query | 1–5 ms |

| Capacity rule of thumb | Value |
|---|---|
| Seconds per day | ~10^5 (86,400) |
| Seconds per month | ~2.5 x 10^6 |
| Requests/s per stateless app server | 1k–10k (depends heavily on work done) |
| Redis node | 100k+ simple ops/s |
| Relational DB primary | ~5k–20k writes/s, tens of thousands of simple reads/s |
| Kafka partition | ~10 MB/s write comfortably |
| 1 Gbps NIC | ~125 MB/s |

| Powers of two | Size |
|---|---|
| 2^10 | 1 thousand (KB) |
| 2^20 | 1 million (MB) |
| 2^30 | 1 billion (GB) |
| 2^40 | 1 trillion (TB) |
| 2^50 | PB |

Handy sizes: a UUID is 16 bytes (36 as a string), a 64-bit ID is 8 bytes, a tweet-sized text row is ~300 bytes with metadata, a compressed photo is 200 KB–3 MB, a minute of 1080p video is ~100 MB.

## Turning numbers into decisions

```text
150k reads/s  --> cache hit 90% --> 15k/s to DB --> a few read replicas
300 writes/s  --> a single primary handles it; shard later for storage, not QPS
7 PB/year     --> object storage, not database blobs
10 GB/s egress --> CDN mandatory
```

This is the real point: each number should change or confirm a design choice.

## Common mistakes

- Spending eight minutes on arithmetic. Budget about three to five.
- Mixing bits and bytes in bandwidth (network links are quoted in bits).
- Forgetting replication (x3) and indexes when sizing storage.
- Computing numbers and then never referring to them again.
- False precision: "1,157.4 QPS" should be "about 1k QPS".

## In the interview

**Q: Your service gets 1B requests per day. What's the QPS?**
1B / 10^5 = 10k QPS average, so plan for 20k–50k at peak.

**Q: Will the metadata fit on one machine?**
Compute total rows x row size x retention. If it is under a few terabytes and write QPS is under ~10k, a single primary with replicas works; beyond that, shard.

**Q: Why do you care about egress?**
Bandwidth is often the most expensive line item and the earliest bottleneck for media systems. Large egress pushes you toward CDNs, compression, and smaller encodings.

## Key takeaways

- Use 10^5 seconds per day and round everything to one significant figure.
- Estimate QPS (with peak), storage (with replication), and bandwidth.
- Memorize a small table of latencies and per-node capacities.
- Every estimate should justify a design decision.
