Microservices are often presented as the grown-up architecture and monoliths as legacy, but each is a trade-off between team independence and operational complexity. Senior engineers are expected to argue for the boundary that fits the team and the problem, not for a fashion.

## The analogy

A monolith is a single large restaurant kitchen: everyone shares the same space, ingredients, and head chef, so coordination is easy, but one fire closes the whole kitchen and a new menu means everyone changes together. Microservices are a food court: each stall runs independently with its own staff and hours, but getting a combined meal requires walking between stalls, and the food court needs shared plumbing, security, and cleaning.

## What each gives you

| | Monolith | Microservices |
|---|---|---|
| Deployment | One artifact, one pipeline | Independent per service |
| Scaling | Scale the whole app | Scale hot services independently |
| Data | One database, easy joins and transactions | Database per service; consistency via events and sagas |
| Calls | In-process function calls (nanoseconds) | Network calls (milliseconds), can fail |
| Team autonomy | Shared codebase, coordination needed | Teams own services end to end |
| Technology | One stack | Polyglot possible |
| Debugging | One stack trace | Distributed tracing required |
| Failure isolation | One bug can crash everything | Failures can be contained (with effort) |
| Operational overhead | Low | High: service discovery, observability, CI/CD per service, versioning |

## The modular monolith

A middle path: one deployable, but code organized into strict modules with clear interfaces and separate schemas or tables per module. You get easy transactions and simple operations now, and clean seams for extracting services later. Many successful companies run large modular monoliths for years.

```text
Modular monolith                         Microservices
+------------------------------+         +--------+  +--------+  +---------+
| [Users] [Orders] [Payments]  |         | Users  |  | Orders |  | Payment |
|   |        |         |       |   -->   |  DB    |  |  DB    |  |   DB    |
|  schema   schema   schema    |         +---+----+  +---+----+  +----+----+
|      one database            |             \___ events / APIs ___/
+------------------------------+
```

## When microservices make sense

- Many teams (dozens of engineers) block each other in a shared codebase and release train.
- Parts of the system have very different scaling, latency, or reliability profiles (a video transcoder versus a profile service).
- Different compliance boundaries (PCI scope for payments).
- The domain boundaries are well understood and stable.

## When they do not

- Small team, early product, boundaries still changing.
- Most features touch most services, so every change needs coordinated deploys (a "distributed monolith").
- No investment yet in automation, observability, and on-call maturity.

## Drawing boundaries

Use domain-driven design ideas: split along **bounded contexts** where the language and data ownership change (catalogue, ordering, payments, shipping). Each service owns its data; other services access it only through APIs or events. Boundaries that require frequent synchronous calls or shared tables are wrong.

## Communication

- **Synchronous** (REST/gRPC) for queries that need an immediate answer; watch for long call chains that multiply latency and failure probability.
- **Asynchronous** events for state changes other services react to; improves decoupling and resilience.
- Prefer choreography via events for simple flows and orchestration (a saga coordinator) for complex multi-step workflows.

## Common mistakes

- Splitting by technical layer (a "database service", a "validation service") instead of by business capability.
- Sharing one database across services, which couples them at the schema level.
- Chains of five synchronous hops on the critical path.
- Migrating to microservices to fix problems that are really about code quality or testing.

## In the interview

**Q: Would you start this product as microservices?**
Usually a modular monolith first, with clear module boundaries and separate schemas, extracting services when team size or scaling needs justify it. In a system-design interview you may still draw separate services to show logical boundaries; say that they could be deployed together initially.

**Q: How do you handle a transaction that spans the order and payment services?**
Avoid distributed ACID transactions; use a saga with compensating actions, and publish events reliably with a transactional outbox.

**Q: What is a distributed monolith?**
Services that must be deployed together and call each other synchronously for every operation, so you get the costs of microservices without the independence.

## Key takeaways

- Microservices buy team autonomy and independent scaling at a large operational cost.
- A modular monolith is often the right starting point.
- Split by business capability and data ownership, never share databases.
- Favour asynchronous events between services to limit coupling.
