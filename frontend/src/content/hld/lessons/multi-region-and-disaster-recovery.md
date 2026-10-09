A single region can fail: power, networking, a bad configuration push, or a cloud control-plane outage. Multi-region design decides how much data you can afford to lose and how fast you must recover, and those two numbers drive cost and complexity more than anything else.

## The analogy

A business with one office loses everything if it floods. Keeping nightly copies of files in a storage unit across town is cheap but slow to recover from (backup and restore). Keeping a furnished second office with copies updated hourly lets staff move in the same day (warm standby). Running two fully staffed offices that both serve customers means a flood barely registers, but you pay for two offices and must keep them coordinated (active-active).

## RPO and RTO

- **RPO (recovery point objective)**: how much data loss is acceptable, measured in time. RPO of 5 minutes means you may lose the last 5 minutes of writes.
- **RTO (recovery time objective)**: how long until service is restored.

| Strategy | RPO | RTO | Cost |
|---|---|---|---|
| Backup and restore (cross-region backups) | Hours | Hours to a day | Low |
| Pilot light (data replicated, minimal compute off) | Seconds to minutes | Tens of minutes | Low-medium |
| Warm standby (scaled-down full stack running) | Seconds | Minutes | Medium |
| Active-passive hot standby | Seconds (async) or zero (sync) | Minutes | High |
| Active-active | Near zero to seconds | Near zero | Highest |

## Active-passive

```text
             DNS / global LB (health-checked)
                 |                 .
                 v                 . (failover)
        +----------------+     +----------------+
        | Region A (live)|     | Region B (standby)
        | app + DB primary --async--> DB replica |
        +----------------+     +----------------+
```

- All writes go to one region; data replicates asynchronously to the other.
- Failover: promote the replica, scale up compute, shift traffic. Async replication means the last few seconds of writes may be lost (RPO > 0).
- Simple consistency model; the standby is often under-tested, so practise failovers regularly ("game days").

## Active-active

Both regions serve reads and writes.

- **Partitioned (home region)**: each user's data has a home region, and their writes go there. Other regions can serve reads or forward writes. No write conflicts, local latency for most users, and it doubles as data residency compliance.
- **Multi-writer with conflict resolution**: any region accepts any write (DynamoDB global tables, Cassandra multi-DC). Conflicts resolve by last-writer-wins or CRDTs. Suits data where conflicts are rare or mergeable.
- **Globally consistent database**: Spanner, CockroachDB, Aurora DSQL-like systems use consensus across regions. Strong consistency, but each write pays cross-region latency (tens to hundreds of milliseconds).

```text
 Users (EU) --> EU region: app + EU partition leader <--replication--> US region
 Users (US) --> US region: app + US partition leader <--replication--> EU region
```

## Traffic steering

- **GeoDNS / latency routing** with health checks; failover is limited by DNS TTLs.
- **Anycast global load balancers** shift traffic in seconds without waiting for DNS caches.
- Keep **capacity headroom**: if two regions each run at 70%, losing one sends 140% to the other. Active-active needs each region sized to absorb the other's load (or shed non-critical traffic).

## What else must be multi-region

- Secrets, configuration, container images, and DNS.
- Identity provider and auth keys.
- Queues and caches (caches can usually start cold, but plan for the load spike).
- Control-plane dependencies: if failover requires an API in the failed region, it will not work.
- Runbooks and automation, tested regularly.

## Data residency

Laws such as GDPR or India's data protection rules may require personal data to stay in a jurisdiction. Home-region partitioning handles this naturally; global replication of personal data may be prohibited, so separate regulated data from global metadata.

## Common mistakes

- Never testing failover, then discovering the standby is misconfigured during a real outage.
- Claiming zero RPO with asynchronous replication.
- Hidden single-region dependencies (a central auth service, an S3 bucket, a CI system).
- Active-active writes to the same records with last-writer-wins and unsynchronized clocks.

## In the interview

**Q: How would you make this service survive a full region outage?**
State target RPO and RTO first. For RPO of seconds and RTO of minutes: active-passive with async database replication, infrastructure-as-code to scale the standby, a global load balancer with health checks, and quarterly failover drills.

**Q: When would you choose active-active?**
When downtime is extremely costly or users are global and need low latency. Prefer partitioning users by home region to avoid write conflicts; use a globally consistent database only for data that truly needs it.

**Q: What is the difference between RPO and RTO?**
RPO bounds data loss (how far back you recover to); RTO bounds downtime (how long recovery takes).

## Key takeaways

- Start from RPO and RTO; they determine the strategy and the bill.
- Active-passive is simpler; active-active gives the best availability with conflict and capacity costs.
- Home-region partitioning avoids conflicts and helps data residency.
- Untested failover is not a plan; drill it and remove hidden single-region dependencies.
