Messaging systems let services hand off work without waiting for each other. But "a queue" covers two very different ideas: a work queue that deletes messages once processed, and a log that keeps every event so many consumers can read and replay it.

## The analogy

A work queue is a ticket rail in a restaurant kitchen: a cook takes a ticket, makes the dish, and the ticket is thrown away. A log is a newspaper archive: every edition is kept in order, and any number of readers can start from any date and read forward at their own pace.

## Why use messaging at all

- **Decoupling**: producers do not need consumers to be up.
- **Load levelling**: a spike of 50k requests/s can be queued and drained at 5k/s.
- **Fan-out**: one event feeds many independent consumers.
- **Retries and failure isolation**: a slow downstream does not block the user request.

## Work queue model (RabbitMQ, SQS)

```text
Producer --> [ m5 m4 m3 m2 m1 ] --> Consumer A (gets m1)
                                --> Consumer B (gets m2)   competing consumers
ack -> message deleted;  no ack before timeout -> redelivered
```

- Each message goes to one consumer in a group.
- Messages are removed after acknowledgement.
- Per-message features: priorities, delays, TTLs, dead-letter queues.

## Log model (Kafka, Kinesis, Pulsar)

```text
Topic "orders", partition 0: [0][1][2][3][4][5][6] ...  (append only, retained 7 days)
                                     ^           ^
                     analytics group offset=2    billing group offset=6
```

- Messages are appended to partitions and retained by time or size, not deleted on read.
- Each consumer group tracks its own offset; groups are independent.
- Order is guaranteed within a partition. Messages with the same key go to the same partition.
- Parallelism is capped by partition count: one partition is read by at most one consumer in a group.
- Replay is easy: reset the offset to reprocess history.

## Kafka vs RabbitMQ vs SQS

| | Kafka | RabbitMQ | SQS |
|---|---|---|---|
| Model | Partitioned, replicated log | Broker with exchanges and queues | Managed queue |
| Retention | Time/size based, replayable | Until acknowledged | Up to 14 days, until deleted |
| Ordering | Per partition | Per queue (with one consumer) | FIFO queues: per message group; standard: best effort |
| Throughput | Very high (MB/s per partition, millions msg/s per cluster) | Tens of thousands msg/s per node typical | Effectively unlimited (standard); FIFO lower |
| Routing | By key to partition | Rich: direct, topic, fanout, headers exchanges | Simple; fan-out via SNS |
| Consumer model | Pull, offsets | Push with prefetch | Pull with visibility timeout |
| Delivery | At-least-once; transactions for exactly-once within Kafka | At-least-once with acks | At-least-once; FIFO has dedup window |
| Ops burden | High (unless managed) | Medium | None |
| Best for | Event streams, CDC, analytics, event sourcing | Task queues, complex routing, RPC-style work | Simple decoupling on AWS |

## Choosing

- Many independent consumers of the same events, replay, or stream processing: **Kafka/Kinesis**.
- Background jobs, per-message retries and delays, flexible routing: **RabbitMQ** or **SQS**.
- Minimal operations on AWS: **SQS** (+ SNS for fan-out), EventBridge for event routing.

## Key mechanics to mention

- **Visibility timeout (SQS)**: a received message is hidden for N seconds; if not deleted in time, it reappears. Set it longer than worst-case processing time.
- **Prefetch (RabbitMQ)**: limit unacknowledged messages per consumer to avoid one consumer hoarding work.
- **Dead-letter queues**: after N failed attempts, move a message aside for inspection instead of retrying forever (a "poison message").
- **Backpressure**: monitor queue depth and consumer lag; autoscale consumers on them.
- **Partition count (Kafka)**: plan for future parallelism; increasing partitions later changes key-to-partition mapping.

## Common mistakes

- Using Kafka as a job queue that needs per-message retries and delays; it lacks those natively.
- One partition for a high-volume topic, then being stuck with one consumer.
- Assuming global ordering across a whole topic.
- No DLQ, so one malformed message blocks a partition or retries forever.

## In the interview

**Q: Kafka or SQS for order events consumed by billing, analytics, and email?**
Kafka (or SNS fanning out to multiple SQS queues). Kafka lets each consumer group read independently and replay history; with SNS+SQS each consumer gets its own queue, which is simpler to operate but has no long-term replay.

**Q: How do you keep a customer's events in order while scaling consumers?**
Partition by customer_id so all of a customer's events land in one partition, which one consumer processes sequentially. Different customers are processed in parallel.

**Q: What happens if a consumer crashes mid-processing?**
The message was not acknowledged (or offset not committed), so it is redelivered to another consumer. Processing must therefore be idempotent.

## Key takeaways

- Work queues distribute tasks and delete them; logs retain events for many readers and replay.
- Kafka: high-throughput, ordered per partition, replayable. RabbitMQ: flexible routing. SQS: zero-ops.
- Partition by the key whose order matters.
- Plan for redelivery, poison messages, and consumer lag from the start.
