When a business operation spans several services, you cannot wrap it in one database transaction. A saga breaks it into local transactions with compensating actions for rollback, and the transactional outbox makes sure each step's events are published reliably.

## The analogy

Booking a holiday: you reserve a flight, then a hotel, then a car. If the car rental fails, you do not "un-happen" the flight; you cancel it, possibly paying a fee. Each booking is its own transaction, and each has a defined undo. That chain of bookings with cancellations is a saga.

## Saga structure

A saga is a sequence of steps T1, T2, ..., Tn, each a local ACID transaction in one service, with compensations C1, ..., Cn-1. If Tk fails, run Ck-1 ... C1 in reverse.

```text
Order:   T1 create order (PENDING)          C1 cancel order
Payment: T2 authorize payment               C2 void authorization
Stock:   T3 reserve items                   C3 release items
Ship:    T4 create shipment
Order:   T5 mark order CONFIRMED

T3 fails -> C2 void payment -> C1 cancel order
```

Compensations are semantic, not literal: you cannot delete a sent email, but you can send a correction. Some steps are **pivot** steps after which the saga must go forward (for example once goods have shipped), and later steps must be retryable until they succeed.

## Choreography vs orchestration

**Choreography**: each service listens for events and reacts.

```text
Order svc --OrderCreated--> Payment svc --PaymentAuthorized--> Inventory svc --ItemsReserved--> Order svc
```

Simple for short flows with few participants, but the overall workflow is implicit and hard to follow, and cyclic dependencies creep in.

**Orchestration**: a central saga orchestrator tells each service what to do and tracks state.

```text
                 +-----------------------+
                 |  Checkout orchestrator|  (state machine, persisted)
                 +---+--------+------+---+
        commands     |        |      |
                     v        v      v
                Payment   Inventory  Shipping
```

Explicit, easy to monitor and change, handles timeouts and compensations in one place. Workflow engines like Temporal, AWS Step Functions, or Cadence make this durable. The orchestrator must itself be reliable and must not absorb domain logic.

| | Choreography | Orchestration |
|---|---|---|
| Coupling | Event-level, decentralized | Central coordinator |
| Visibility | Low | High |
| Best for | 2–4 steps | Complex flows, many failure paths |

## Saga pitfalls

- **Lack of isolation**: other transactions see intermediate states (an order PENDING, stock reserved). Use semantic locks (status fields), and design reads to tolerate pending states.
- **Every step and compensation must be idempotent**, because messages are delivered at least once.
- **Compensations can fail** too; they must be retried until they succeed, with alerts for manual intervention.

## The dual-write problem

A service must update its database and publish an event. Doing both directly is unsafe:

```text
db.commit()      -- succeeds
broker.publish() -- process crashes here -> event lost, other services never learn
```

Reversing the order is no better: the event may go out for a transaction that rolls back.

## Transactional outbox

Write the event into an **outbox table** in the same local transaction as the business change. A separate relay reads the outbox and publishes to the broker.

```text
BEGIN;
  UPDATE orders SET status='PAID' WHERE id=42;
  INSERT INTO outbox(id, aggregate_id, type, payload) VALUES (uuid, 42, 'OrderPaid', '{...}');
COMMIT;

Relay (poller or CDC via Debezium reading the WAL) --> Kafka topic "orders"
```

- Atomic: either both the state change and the event exist, or neither.
- Delivery is at-least-once (the relay may publish twice after a crash), so consumers must be idempotent; include the outbox row ID as the event ID.
- **CDC-based relays** read the database log, avoiding polling load and preserving commit order.
- The **inbox pattern** on the consumer side records processed event IDs in the same transaction as their effects.

## Common mistakes

- Designing compensations that are not idempotent or that can fail permanently.
- Choreographed sagas with many services, where nobody can explain the full flow.
- Publishing events outside the transaction ("we'll just retry the publish").
- Forgetting timeouts: a step that never answers must eventually trigger compensation.

## In the interview

**Q: How do you implement checkout across order, payment, and inventory services?**
An orchestrated saga: create order as pending, reserve inventory, authorize payment, confirm. On any failure, run compensations in reverse (void authorization, release stock, cancel order). Each service publishes its events through an outbox, and all handlers are idempotent.

**Q: How do you guarantee an event is published if the database commit succeeds?**
Write it to an outbox table in the same transaction and have a relay (polling or CDC) publish it, retrying until acknowledged.

**Q: What isolation problems do sagas have?**
Intermediate states are visible to other operations. Mitigate with status fields that act as semantic locks, ordering steps so the riskiest or most easily compensated come first, and re-validating state before final steps.

## Key takeaways

- A saga is a chain of local transactions with compensating actions.
- Orchestration is clearer for complex flows; choreography suits short ones.
- Sagas give eventual consistency; design for visible intermediate states.
- The transactional outbox removes the dual-write problem; pair it with idempotent consumers.
