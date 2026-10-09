Sometimes one logical change must update several databases or shards, and either all of them must commit or none. Two-phase commit (2PC) is the classic protocol for this, and understanding its failure modes explains why most microservice systems avoid it.

## The analogy

A wedding officiant asks both partners "do you take this person?" (prepare). Only if both say yes does the officiant pronounce them married (commit). If either says no, the wedding is off (abort). But if the officiant faints after hearing two yeses and before the pronouncement, both partners are stuck at the altar, unable to leave or proceed, until the officiant wakes up.

## How 2PC works

```text
Coordinator                 Participant A            Participant B
    |---- PREPARE --------------->|                         |
    |---- PREPARE ---------------------------------------->|
    |                      write redo/undo, lock rows       |
    |<--- YES (prepared) ---------|                         |
    |<--- YES (prepared) -----------------------------------|
  log "COMMIT" durably
    |---- COMMIT ---------------->|                         |
    |---- COMMIT ----------------------------------------->|
    |<--- ACK ---------------------|<-----------------------|
```

**Phase 1, prepare**: the coordinator asks each participant whether it can commit. A participant that votes yes has durably recorded the changes and **promises** it can commit later, holding its locks.

**Phase 2, commit or abort**: if every participant voted yes, the coordinator durably logs the decision and tells everyone to commit. If any voted no or timed out, it tells everyone to abort.

## Failure modes

- **Participant fails before voting**: coordinator aborts. Fine.
- **Participant fails after voting yes**: on recovery it must ask the coordinator for the outcome; it cannot decide alone.
- **Coordinator fails after collecting votes but before sending the decision**: prepared participants are **blocked**, holding locks, until the coordinator recovers. This is the fundamental weakness: 2PC is a blocking protocol.
- **Network partition**: participants on the far side wait indefinitely.

The coordinator therefore needs to be highly available itself, often by replicating its log with consensus (which is what Spanner does: each participant is a Paxos group, so no single failure blocks it).

## Costs

- At least two round trips plus durable log writes on every node, adding latency.
- Locks are held across network round trips, reducing throughput and increasing contention.
- Every participant must support the protocol (XA transactions in relational databases and some brokers). Many modern services and SaaS APIs do not.
- Availability becomes the product of all participants' availability.

## Where 2PC is used

- **Inside a distributed database** across its own shards: Spanner, CockroachDB, YugabyteDB, and Vitess (optionally) use 2PC variants, made robust by consensus-replicated participants and coordinators.
- **Kafka transactions** use a 2PC-like protocol between a transaction coordinator and partitions.
- **XA** between a database and a message broker in older enterprise stacks.

It is rarely used **across independently owned microservices**, because it couples their availability, holds locks across services, and requires all of them to speak the same protocol.

## Alternatives

| Approach | Consistency | Coupling | Use when |
|---|---|---|---|
| 2PC / XA | Atomic | Tight, blocking | Within one database system |
| Saga with compensations | Eventual, with business rollback | Loose | Cross-service workflows |
| Transactional outbox | Atomic DB write + reliable event | Loose | Publish an event with a DB change |
| Redesign boundaries | Local ACID | None | When two services always change together |

3PC (three-phase commit) adds a pre-commit phase to reduce blocking, but it assumes bounded network delays and is not safe under partitions, so it is mostly of academic interest.

## Common mistakes

- Proposing 2PC across microservices owned by different teams.
- Forgetting the coordinator is a single point of failure unless replicated.
- Ignoring lock duration: a slow participant holds locks for every other participant.
- Assuming "distributed transaction" means 2PC; sagas are usually the better answer.

## In the interview

**Q: Why not use 2PC between the order and payment services?**
It would make both services' availability interdependent, hold locks across network calls, and block if the coordinator fails. Third-party payment APIs cannot participate anyway. A saga with idempotent steps and compensations is more practical.

**Q: What makes 2PC blocking?**
A participant that has voted yes cannot unilaterally commit or abort; it must wait for the coordinator's decision. If the coordinator is down, it waits holding locks.

**Q: How does Spanner make cross-shard transactions practical?**
Each shard is a Paxos-replicated group, so participants and the coordinator are fault tolerant, and TrueTime-based timestamps give globally consistent ordering. 2PC still costs latency, but it no longer blocks on a single machine failure.

## Key takeaways

- 2PC gives atomic commit: prepare (vote) then commit or abort.
- It is blocking: a coordinator failure can leave participants holding locks.
- It works well inside distributed databases with replicated participants.
- Across microservices, prefer sagas and the outbox pattern.
