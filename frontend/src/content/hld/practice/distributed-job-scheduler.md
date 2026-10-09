A distributed job scheduler runs tasks at specific times or on recurring schedules (cron), across a fleet of workers, without missing or duplicating runs. Think of it as cron for a whole company: reports, billing runs, reminders, and cleanup jobs, many millions per day.

## Clarify requirements

**Functional**
- Submit one-off jobs ("run at T") and recurring jobs (cron expressions).
- Jobs carry a payload and a target (an HTTP endpoint, a queue, or a container/task).
- Retries with backoff on failure; max attempts; dead-lettering.
- Query job status and history; cancel or pause jobs.
- Optional: priorities, dependencies between jobs (DAGs) as an extension.

**Non-functional**
- 100M job executions/day, with peaks at round times (every hour at :00, midnight).
- Start a job within ~1–5 seconds of its scheduled time.
- At-least-once execution with deduplication so effects happen once.
- Highly available: no single scheduler failure stops jobs.
- Durable: accepted jobs are never lost.

## Back-of-the-envelope

- 100M/day ÷ 10^5 ≈ **1,000 executions/s** average.
- Peak: if 20% of jobs are scheduled exactly at the top of an hour, 100M × 0.2 / 24 ≈ 830k jobs at once → spread over a minute ≈ **14k/s**.
- Job definitions: 50M active jobs × 1 KB = **50 GB**.
- Execution history: 100M/day × 300 B = **30 GB/day**; retain 30 days hot.
- If an average job runs 30 s, Little's law gives 1,000 × 30 = **30k concurrent executions** across workers.

## API

```text
POST /v1/jobs
  { "name": "daily-report", "schedule": "0 2 * * *", "timezone": "Asia/Kolkata",
    "target": { "type": "http", "url": "https://reports/run", "timeoutSec": 300 },
    "payload": {...}, "retry": { "max": 5, "backoff": "exponential" },
    "idempotencyKey": "tenant42-daily-report" }
  201: { "jobId": "j123", "nextRunAt": "..." }

POST /v1/jobs/{id}/pause | /resume | DELETE /v1/jobs/{id}
GET  /v1/jobs/{id}/runs?cursor=     -> run history with status
```

Each execution receives a stable `runId` (jobId + scheduled time) so targets can deduplicate.

## Data model

```text
jobs (sharded by job_id)
  job_id, owner, schedule (cron or one-off), timezone, target, payload, retry_policy, status, version

job_runs / schedule index (sharded by bucket)
  bucket = (shard_id, minute_of_scheduled_time)
  run_id = job_id + scheduled_at   (unique)
  status: SCHEDULED | QUEUED | RUNNING | SUCCEEDED | FAILED | RETRY_WAIT
  attempt, lease_owner, lease_expires_at, next_attempt_at
```

The key query is "which runs are due in the next minute for my shard?", so runs are indexed by time bucket within each shard.

## High-level design

```text
 Clients --> Job API --> Jobs DB (definitions) 
                    \--> creates next run in Runs DB (time-bucketed)

            +------------------------------------------------+
            | Scheduler nodes (each owns N shards via leases) |
            |  every second: scan due runs in owned shards    |
            |  conditional update SCHEDULED -> QUEUED         |
            +-----------------------+------------------------+
                                    v
                        Kafka / SQS "jobs.ready" (by priority)
                                    v
                 Worker fleet (pull, execute target, heartbeat)
                                    |
                 report result --> Runs DB (SUCCEEDED / RETRY_WAIT / FAILED)
                                    |
                 on completion of recurring job: compute next run, insert it

 Coordination store (etcd/ZooKeeper): shard ownership leases for schedulers
 Watchdog: finds RUNNING runs with expired leases -> requeue
```

## Deep dives

### 1. Finding due jobs efficiently

Scanning a giant table for `run_at <= now` doesn't scale. Instead:

- Partition runs into **shards** (by hash of job_id) and **time buckets** (per minute). Each scheduler polls only its shards' current and next buckets.
- For sub-second precision, a scheduler loads the next minute's runs into an in-memory timing wheel or min-heap and dispatches each at its exact time.
- Recurring jobs: only the next occurrence is materialized; when it completes (or is dispatched), the next one is computed from the cron expression and inserted.

### 2. No missed runs, no duplicate runs

- **Shard ownership via leases**: each shard is owned by exactly one scheduler at a time (etcd lease). If the scheduler dies, another acquires the lease and resumes, including any overdue runs (catch-up policy configurable: run all missed, run once, or skip).
- **Fencing and conditional updates**: dispatch is `UPDATE runs SET status='QUEUED', owner=? WHERE run_id=? AND status='SCHEDULED'`. A zombie scheduler with an expired lease can't double-dispatch because the conditional update fails (or a fencing token check rejects it).
- **Worker leases**: workers mark runs RUNNING with a lease and heartbeat. If a worker dies, the watchdog sees the expired lease and requeues the run.
- Since a worker might finish the work and die before reporting, execution is **at-least-once**. Targets receive the `runId` as an idempotency key to make effects happen once.

### 3. Handling the top-of-the-hour thundering herd

Hundreds of thousands of jobs at 00:00:

- Pre-load due runs in the minute before and dispatch from memory.
- Queue absorbs bursts; workers autoscale on queue depth, but pre-scale ahead of known peaks.
- Encourage (or apply) jitter for jobs that don't need exact times ("run hourly" → spread within the hour).
- Priority queues ensure critical jobs (billing) aren't starved by bulk jobs.
- Per-tenant concurrency limits prevent one tenant's 100k jobs from monopolizing workers.

### 4. Retries and failure handling

- Retry transient failures with exponential backoff + jitter by setting status RETRY_WAIT and `next_attempt_at`; the scheduler treats it as a due run when that time arrives.
- Enforce timeouts per job; kill and retry or fail.
- After max attempts, mark FAILED, move to a dead-letter queue, and alert the owner.

## Bottlenecks & scaling

- **Runs DB writes**: ~3–4 writes per execution (create, queue, start, finish) ≈ 4k–60k writes/s at peak → a horizontally scalable store (DynamoDB, Cassandra, or sharded Postgres).
- **Scheduler**: add shards and nodes; shards rebalance via leases.
- **Workers**: stateless, autoscaled; heavy jobs run in isolated containers.
- **Time zones and DST**: compute next run times in the job's timezone; define behaviour for skipped/repeated hours.
- **Observability**: lag between scheduled and actual start time is the key SLI.

## Follow-ups the interviewer may ask

- **How do you support job dependencies (DAGs)?** A workflow layer tracks the DAG state and enqueues children when parents succeed, like Airflow or Temporal.
- **How do you guarantee exactly-once?** You can't guarantee it for arbitrary external side effects; you provide at-least-once with a stable run ID and targets deduplicate.
- **What if the coordination store is down?** Existing leases keep working until expiry; schedulers stop acquiring new shards. Keep lease TTLs long enough to ride out brief blips.
- **How do you cancel a running job?** Mark it cancelled; workers check status on heartbeat and abort cooperatively.
- **How does this compare with Kafka delay queues or SQS delay?** Those handle short delays (SQS up to 15 minutes); long-range and cron schedules need a persistent time index.
