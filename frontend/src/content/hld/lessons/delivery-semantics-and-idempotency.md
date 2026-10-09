In a distributed system, a message can be lost, or delivered more than once, and the sender often cannot tell which. Delivery semantics describe what a system guarantees; idempotency is how you make "more than once" harmless.

## The analogy

You text a friend "transfer me 500 rupees" and get no reply. Did the message fail, or did the reply get lost? If you resend and both arrive, you might get paid twice. If your friend keeps a note of "requests already handled" with a reference number, they can ignore the duplicate. That reference number is an idempotency key.

## The three semantics

| Semantics | How it is achieved | Risk | Use for |
|---|---|---|---|
| At-most-once | Acknowledge before processing, never retry | Messages lost | Metrics samples, non-critical telemetry |
| At-least-once | Acknowledge after processing, retry on doubt | Duplicates | Almost everything (default) |
| Exactly-once | Not possible end-to-end in general; emulated | Complexity | Billing, payments, counters |

```text
At-least-once failure mode:
Consumer: receive m1 -> process (charge card) -> crash before ack
Broker:   no ack -> redeliver m1 -> process again -> double charge!
```

## Why exactly-once delivery is a myth

Over an unreliable network, the sender cannot distinguish "the message was lost" from "the acknowledgement was lost". To avoid loss it must retry, which risks duplicates. What systems actually offer is **effectively-once processing**: at-least-once delivery combined with deduplication or idempotent effects, so the outcome happens once.

Kafka's "exactly-once" means: idempotent producers (no duplicate appends on retry) plus transactions that atomically write output records and commit consumer offsets, all inside Kafka. As soon as a side effect leaves Kafka (an email, an API call, a database write), you need idempotency again.

## Making consumers idempotent

**Naturally idempotent operations**: "set status = SHIPPED", "set balance = 100", upserts by primary key, deleting by ID. Applying them twice gives the same result.

**Non-idempotent operations**: "increment balance by 100", "send email", "insert new row". These need protection:

1. **Deduplication table**: store processed message IDs with a unique constraint, in the same database transaction as the side effect.

```text
BEGIN;
  INSERT INTO processed_messages(message_id) VALUES ('m1');  -- fails if duplicate
  UPDATE accounts SET balance = balance + 100 WHERE id = 7;
COMMIT;
```

2. **Idempotency keys on APIs**: the client generates a key per logical operation; the server stores the key and its response, returning the stored response on retries.

3. **Conditional writes / versions**: `UPDATE ... WHERE version = 5`, or DynamoDB condition expressions, so a replay against already-changed state is rejected.

4. **Pass keys downstream**: when calling a payment provider, forward a stable idempotency key so the provider deduplicates too.

## Ordering interacts with duplicates

A retried old message can arrive after a newer one. If the handler is "set status = X", an out-of-date message can roll state backwards. Include a sequence number or version per entity and ignore messages older than the stored version.

## Producer side

- Retry publishes with backoff; enable idempotent producers where available.
- Avoid the **dual-write problem** (update DB, then publish, crash in between) with the transactional outbox pattern: write the event into an outbox table in the same transaction and relay it asynchronously.

## How long to remember

Deduplication state can grow forever. Bound it by retention: keep IDs for longer than the maximum redelivery window (for example 7 days for a Kafka topic with 7-day retention), using a TTL in DynamoDB or Redis, or partitioned tables you drop.

## Common mistakes

- Claiming "Kafka gives us exactly-once" for a pipeline that sends emails.
- Checking for duplicates and performing the side effect in separate, non-atomic steps.
- Using a random ID generated on each retry, defeating deduplication.
- Ignoring reordering, so a stale event overwrites newer state.

## In the interview

**Q: How do you avoid charging a customer twice when the payment worker retries?**
Use an idempotency key per payment intent, recorded with a unique constraint before calling the processor, and pass the same key to the processor. On retry, look up the stored outcome instead of charging again.

**Q: Can you achieve exactly-once delivery?**
Not as a network guarantee. You achieve effectively-once outcomes with at-least-once delivery plus idempotent processing or transactional deduplication.

**Q: Your consumer increments a counter. How do you make it safe?**
Record the event ID in a dedup set in the same atomic operation as the increment, or restructure into idempotent per-event records that are aggregated later.

## Key takeaways

- At-least-once delivery is the practical default; design for duplicates.
- Effectively-once = at-least-once + idempotency or transactional dedup.
- Idempotency keys must be stable across retries and recorded atomically with effects.
- Use versions or sequence numbers to reject out-of-order stale messages.
