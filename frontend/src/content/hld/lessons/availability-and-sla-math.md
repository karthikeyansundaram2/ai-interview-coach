"Highly available" means nothing until you put a number on it. Availability math tells you how much downtime each extra nine allows, and how stacking dependencies quietly erodes the number you promised.

## The analogy

A string of old holiday lights wired in series goes dark if any single bulb fails, so more bulbs means more chances of darkness. A room with two independent lamps stays lit unless both fail at once. Systems behave the same: dependencies in series multiply risk, redundancy in parallel divides it.

## The nines

Availability = uptime / total time, usually measured over a month or year.

| Availability | Downtime per year | Per month | Per week |
|---|---|---|---|
| 99% (two nines) | 3.65 days | 7.3 hours | 1.7 hours |
| 99.9% | 8.8 hours | 43.8 minutes | 10 minutes |
| 99.95% | 4.4 hours | 21.9 minutes | 5 minutes |
| 99.99% | 52.6 minutes | 4.4 minutes | 1 minute |
| 99.999% | 5.3 minutes | 26 seconds | 6 seconds |

At four nines you cannot have a human in the recovery loop for most incidents; detection plus failover must be automatic. At five nines even a routine deploy must be invisible.

## SLA, SLO, SLI

- **SLI** (indicator): what you measure, such as the fraction of requests returning non-5xx under 300 ms.
- **SLO** (objective): your internal target, such as 99.9% of requests good over 30 days.
- **SLA** (agreement): a contractual promise with penalties, usually looser than the SLO so you have a buffer.

## Composition in series

If a request must pass through components A, B, and C, all must work:

```text
Client -> LB (99.99%) -> App (99.9%) -> DB (99.9%)

A_total = 0.9999 × 0.999 × 0.999 ≈ 0.9979  (about 99.8%)
```

Every synchronous dependency lowers the ceiling. A service with ten 99.9% dependencies in its critical path tops out near 99%.

## Composition in parallel

If redundant copies can each serve the request, the system fails only when all fail (assuming independent failures):

```text
A_parallel = 1 − (1 − a)^n

Two 99% replicas:   1 − 0.01^2 = 99.99%
Three 99% replicas: 1 − 0.01^3 = 99.9999%
```

```text
            +--> App instance 1 (99%) --+
Client -LB--+                           +--> DB primary + standby
            +--> App instance 2 (99%) --+
```

The independence assumption is the trap. Instances in the same availability zone, on the same deploy, or sharing a config push fail together. Real redundancy needs separate zones, staggered deploys, and independent failure domains.

## MTBF and MTTR

Availability ≈ MTBF / (MTBF + MTTR). You can raise it by failing less often (mean time between failures up) or by recovering faster (mean time to repair down). In practice, cutting MTTR through fast detection, automatic failover, and quick rollbacks is usually cheaper than preventing every failure.

## Raising availability

| Lever | Effect |
|---|---|
| Redundancy across zones/regions | Turns series risk into parallel |
| Remove synchronous dependencies (queues, caches, async) | Fewer multiplications in the chain |
| Graceful degradation (serve stale, hide a widget) | Partial failure is not total failure |
| Health checks and automatic failover | Lower MTTR |
| Progressive rollouts and fast rollback | Fewer self-inflicted outages, which are the majority |

## Common mistakes

- Promising five nines while depending on a single-region database.
- Assuming replicas fail independently when they share a zone, deploy, or config.
- Forgetting third-party dependencies (payment gateway, SMS provider) in the series calculation.
- Measuring availability from the server side only, missing DNS, CDN, and client network failures.

## In the interview

**Q: Your API depends on three services, each at 99.9%. What's your availability?**
About 0.999^3 ≈ 99.7%, so roughly 2.2 hours of downtime per month if failures do not overlap. To do better, make some dependencies optional or asynchronous, or add redundancy.

**Q: How do you get from three nines to four?**
Eliminate single points of failure across zones, automate failover so recovery takes seconds rather than minutes, decouple non-critical dependencies, and invest in safe deployments since change is the biggest cause of outages.

**Q: What is an error budget?**
The allowed unreliability under an SLO. At 99.9% over 30 days you can "spend" about 43 minutes. If the budget is exhausted, teams slow feature releases and focus on reliability.

## Key takeaways

- Each nine cuts allowed downtime by 10x; four nines is about 4 minutes a month.
- Series dependencies multiply availability down; parallel redundancy multiplies failure probability down.
- Redundancy only helps if failures are truly independent.
- Reducing time to recover is often the cheapest path to more nines.
