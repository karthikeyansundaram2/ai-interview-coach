A notification system delivers messages to users through push, SMS, and email on behalf of many internal services. The hard parts are reliability through flaky third-party providers, respecting user preferences and rate caps, and handling huge bursts like a marketing campaign to 50M users.

## Clarify requirements

**Functional**
- Internal services send notifications to a user (or a segment) with a template and data.
- Channels: mobile push (APNs/FCM), SMS, email, in-app.
- User preferences: opt-out per channel and category; quiet hours; locale.
- Priorities: transactional (OTP, payment receipt) versus marketing.
- Scheduling (send at time T) and deduplication.
- Track status: sent, delivered, opened, failed.

**Non-functional**
- 100M users; 500M notifications/day; marketing bursts of 50M in an hour.
- Transactional notifications delivered within seconds; marketing within the hour.
- At-least-once delivery with deduplication so users rarely see duplicates.
- Highly available ingestion; provider outages should not lose notifications.

## Back-of-the-envelope

- 500M/day ÷ 10^5 ≈ **5k/s** average.
- Campaign: 50M in an hour ≈ **14k/s** on top.
- Provider limits matter: e.g. SMS providers might allow a few hundred to a few thousand messages/s per account; APNs/FCM handle very high rates over HTTP/2 connections.
- Notification log: 500M × 500 B ≈ **250 GB/day**; keep 30–90 days hot, archive the rest.
- Device tokens: 100M users × 2 devices × 200 B ≈ 40 GB.

## API

```text
POST /v1/notifications
  { "idempotencyKey": "order-123-shipped",
    "userId": "u42",
    "category": "order_updates",
    "priority": "high",
    "template": "order_shipped",
    "data": { "orderId": "123", "eta": "Fri" },
    "channels": ["push", "email"],          // optional; defaults by category
    "sendAt": null }
  202: { "notificationId": "n_789" }

POST /v1/campaigns { "segmentId": "...", "template": "...", "sendAt": "..." }
GET  /v1/notifications/{id}   -> status per channel
PUT  /v1/users/{id}/preferences
POST /v1/devices { "userId", "platform", "token" }
```

## Data model

```text
notifications (Cassandra/DynamoDB, partitioned by user_id, sorted by created_at)
  notification_id, user_id, category, template, data, priority, status per channel, created_at

idempotency (KV with TTL 24-72h): key -> notification_id
user_preferences (KV, cached): user_id -> {channel/category opt-ins, quiet hours, locale, timezone}
devices: user_id -> [ {device_id, platform, token, last_seen} ]
templates: template_id, version, locale -> subject/body with placeholders
```

## High-level design

```text
 Internal services --> Notification API --(validate, dedup, persist)--> Kafka "notifications.requested"
                                                                                |
                                                                                v
                                                          Router / Fan-out workers
                                       (load prefs, quiet hours, frequency caps, render template,
                                        resolve devices/emails/phones, split per channel)
                                                |                 |                 |
                                    push queue (hi/lo)   email queue (hi/lo)   sms queue (hi/lo)
                                                |                 |                 |
                                         Push workers       Email workers      SMS workers
                                                |                 |                 |
                                           APNs / FCM       SES / SendGrid      Twilio / local
                                                \_________________|_________________/
                                                     delivery callbacks / webhooks
                                                                 |
                                                       Status tracker -> notifications DB, analytics
 Scheduler (for sendAt / campaigns) --> injects into Kafka at the right time
```

Each channel has separate high- and low-priority queues so a marketing campaign never delays OTPs.

## Deep dives

### 1. Reliability and retries with third-party providers

Providers time out, rate-limit, and have outages.

- Channel workers send with timeouts and retry transient errors with exponential backoff and jitter, using retry topics (`push.retry.1m`, `push.retry.10m`) rather than blocking the main queue.
- After N attempts, send to a dead-letter queue and mark failed.
- Circuit breakers per provider; on sustained failure, fail over to a secondary provider (two SMS vendors, two email providers).
- Permanent errors (invalid device token, hard bounce) are not retried; they update the device/email record (remove dead tokens).

### 2. Deduplication and exactly-once feel

Kafka gives at-least-once delivery, so a worker crash after sending but before committing may resend.

- Idempotency key at the API (unique per business event) prevents duplicate requests.
- Per-channel send records: before calling the provider, write `(notification_id, channel) -> SENDING` with a conditional insert; after success, mark SENT. A redelivered message sees SENT and skips. A crash between the provider call and the SENT write can still double-send; pass the notification ID as the provider's idempotency key where supported, accepting rare duplicates otherwise.

### 3. Preferences, quiet hours, and frequency caps

The router enforces:
- Opt-outs per category and channel (legal requirement for marketing).
- Quiet hours in the user's timezone: delay low-priority messages to the next allowed time via the scheduler; high-priority (security, OTP) bypass.
- Frequency caps: e.g. at most 3 marketing pushes/day, using Redis counters per user per day.
- Preferences are cached (Redis/in-process) because every notification reads them.

### 4. Campaign bursts

Sending to a 50M-user segment:

- The campaign service pages through the segment (from a warehouse export or user DB) and publishes in batches to the low-priority topic, throttled to the provider capacity.
- Workers autoscale on queue lag.
- Per-provider token buckets keep sends within contractual rate limits.
- Spread sends across the hour (or by timezone, "9 a.m. local") to avoid self-inflicted spikes on the app backend when users open the notification.

## Bottlenecks & scaling

- **Kafka partitions**: partition by user ID to keep a user's notifications ordered and enable per-user caps; size partitions for peak parallelism.
- **Provider throughput**: usually the real limit; negotiate quotas, use multiple accounts/providers, and shape traffic.
- **Notifications DB**: write-heavy and time-ordered → wide-column store with TTL.
- **Template rendering**: cache compiled templates per version/locale.
- **In-app notifications**: store in the notifications table and push via the existing WebSocket gateway if the user is online.

## Follow-ups the interviewer may ask

- **How do you guarantee OTPs arrive quickly during a campaign?** Separate high-priority topics, workers, and provider quotas; campaigns can only use the low-priority path.
- **How do you track opens and clicks?** Tracking pixels and redirect links for email, open callbacks from mobile apps, all sent as events to an analytics pipeline.
- **What if a user has five devices?** Send to all active tokens; prune tokens not seen in 60 days or reported invalid by the provider.
- **How do you support "send at 9 a.m. local time"?** The scheduler buckets users by timezone and enqueues each bucket at its local 9 a.m.
- **How do you avoid notification spam from a buggy upstream service?** Per-source rate limits at the API, per-user caps, and an emergency kill switch per template or category.
