Observability is the ability to understand what your system is doing from the outside, especially when something unexpected goes wrong. Logs, metrics, and traces are the raw signals; SLOs turn them into a shared definition of "healthy enough".

## The analogy

A car's dashboard shows a few gauges at a glance (metrics). The mechanic's diagnostic log records every fault code with details (logs). A GPS trip replay shows exactly where you went and where you got stuck in traffic (traces). And "arrive within 10 minutes of the estimate 99% of the time" is the promise you judge the whole journey by (SLO).

## The three pillars

**Metrics**: numeric time series with labels, cheap to store and fast to query.
- Counters (requests total), gauges (queue depth), histograms (latency distribution).
- Great for dashboards and alerting.
- Watch cardinality: labelling by user_id creates millions of series and breaks the metrics backend.

**Logs**: timestamped event records, ideally structured (JSON) with request IDs.
- Rich detail for debugging a specific failure.
- Expensive at volume: sample debug logs, keep error logs, set retention tiers.

**Traces**: the path of one request across services, made of spans with timings, linked by a propagated trace ID (W3C `traceparent`, OpenTelemetry).
- Show which hop added latency and where errors originated.
- Usually sampled (for example 1%, plus tail sampling that keeps all slow or failed traces).

```text
Trace 7f3a (total 420 ms)
|-- gateway                 [0 ............................ 420]
|   |-- auth-svc            [5 .. 20]
|   |-- order-svc           [22 ........................ 410]
|   |   |-- postgres query  [30 .. 45]
|   |   |-- payment-svc     [50 ..................... 400]   <-- the slow hop
```

## What to measure

- **RED** for request-driven services: Rate, Errors, Duration.
- **USE** for resources: Utilization, Saturation, Errors (CPU, disk, connection pools).
- **The four golden signals**: latency, traffic, errors, saturation.
- **Business metrics**: orders per minute, payments succeeded; they catch failures technical metrics miss.

## SLIs, SLOs, and error budgets

- **SLI**: a ratio of good events to total events. Example: requests that returned non-5xx in under 300 ms, divided by all requests.
- **SLO**: a target for that SLI over a window. Example: 99.9% over 30 days.
- **Error budget**: 100% minus the SLO. At 99.9% with 100M requests a month, you may fail 100,000 requests.

If the budget is healthy, ship faster and take risks. If it is burning down, freeze risky changes and invest in reliability. This turns reliability arguments into a shared, numeric decision.

## Alerting

- Alert on **symptoms users feel** (SLO burn), not every cause (CPU at 80%).
- **Burn-rate alerts**: page if you are consuming the monthly budget 14x faster than sustainable over the last hour; open a ticket if 2x over six hours. This catches both sudden outages and slow leaks while avoiding noise.
- Every page should be actionable and link to a runbook.

## Architecture of an observability stack

```text
Services (OpenTelemetry SDK)
   | metrics          | logs                  | traces
   v                  v                       v
Prometheus/agent   Log shipper (Fluent Bit)   Collector (sampling)
   v                  v                       v
TSDB (Prometheus,  Log store (Elasticsearch,  Trace store (Tempo,
 Mimir, Datadog)    Loki, CloudWatch)          Jaeger, X-Ray)
         \______________ Grafana / dashboards, alerting _____________/
```

Correlate the three by putting the trace ID in log lines and attaching exemplar trace IDs to latency histograms.

## Common mistakes

- High-cardinality labels in metrics.
- Alerting on causes, producing noisy pages that get ignored.
- Averages instead of percentiles in latency dashboards.
- Logs without request or trace IDs, making cross-service debugging guesswork.
- SLOs set at 100%, leaving no room to deploy.

## In the interview

**Q: How would you know your new service is healthy after launch?**
Define SLIs for availability and latency per critical endpoint, set SLOs, add RED dashboards and burn-rate alerts, emit traces with propagated context, and track a business metric such as successful checkouts per minute.

**Q: Why traces when you already have logs?**
Logs show what happened inside one service. Traces show the causal path and timing across all services for a single request, which is what you need to find a slow or failing hop.

**Q: What is an error budget used for?**
It quantifies acceptable unreliability, so teams can balance feature velocity against stability using data rather than opinion.

## Key takeaways

- Metrics for trends and alerts, logs for detail, traces for cross-service causality.
- Measure RED/USE and business metrics; avoid high-cardinality labels.
- SLOs and error budgets make reliability decisions explicit.
- Alert on user-facing symptoms with burn-rate rules.
