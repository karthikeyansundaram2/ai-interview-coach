An LLD round rewards structure as much as the final design. A repeatable framework keeps you calm, covers what interviewers grade, and leaves time for the extensibility questions where senior candidates stand out.

## The idea

A good doctor doesn't jump to a prescription. They ask about symptoms, examine, form a hypothesis, then treat, and they explain as they go. An LLD interview works the same way: clarify, model, design, walk through, then stress-test. Interviewers are grading your **process** as much as your boxes.

## The seven steps (45-minute round)

```text
 1 Clarify  ->  2 Entities  ->  3 Relationships  ->  4 Class diagram
   (5 min)       (3 min)         (3 min)              (7 min)
                                                         |
 7 Extensibility <- 6 Patterns & concurrency <- 5 Key flows / code
   (5 min)            (5 min)                      (15 min)
```

**1. Clarify requirements.** List functional requirements as bullet points and confirm them. Ask about scale only where it changes the design (multiple floors? concurrent users?). Agree on what's out of scope. Write down 4–6 core use cases.

**2. Identify entities.** Pull nouns from the use cases: `ParkingLot`, `Floor`, `Spot`, `Vehicle`, `Ticket`, `Payment`. Separate entities (with identity), value objects (`Money`, `TimeSlot`), and enums (`SpotType`, `TicketStatus`).

**3. Define relationships.** Who owns whom (composition), who references whom (association), multiplicities. This is where you decide aggregate boundaries.

**4. Draw the class diagram.** Key fields and behaviour-revealing methods.

**5. Walk through key flows and write code.** Pick the 2–3 most important use cases and either narrate the sequence of calls or write the core classes.

**6. Apply patterns and handle concurrency.** Name patterns where they genuinely fit and say *why*. Identify shared mutable state and how you protect it.

**7. Discuss extensibility.** Proactively show how new requirements fit: "a new vehicle type is a new enum value and spot mapping", "a new pricing rule is a new strategy".

```python
# A skeleton you can adapt to almost any LLD prompt.
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum

class Status(Enum):              # step 2: enums for lifecycle and types
    ACTIVE = "active"
    CLOSED = "closed"

@dataclass(frozen=True)
class Money:                     # step 2: value objects
    paise: int

class Policy(ABC):               # step 4/6: interface at a variation point
    @abstractmethod
    def evaluate(self, entity: "Entity") -> Money: ...

@dataclass
class Entity:                    # step 2/3: entity with identity and rules
    entity_id: str
    status: Status = Status.ACTIVE

    def close(self) -> None:
        if self.status is not Status.ACTIVE:
            raise ValueError("already closed")
        self.status = Status.CLOSED

class Repository(ABC):           # architecture: persistence behind a port
    @abstractmethod
    def get(self, entity_id: str) -> Entity: ...

class Service:                   # step 5: facade that runs the key flows
    def __init__(self, repo: Repository, policy: Policy) -> None:
        self._repo, self._policy = repo, policy

    def complete(self, entity_id: str) -> Money:
        entity = self._repo.get(entity_id)
        entity.close()
        return self._policy.evaluate(entity)
```

## When to use / when not to

Use the framework for every LLD and machine-coding round. Adjust the time split by format: a **machine-coding** round (60–90 minutes, runnable code) shifts time toward step 5; a **whiteboard design** round shifts it toward steps 3, 4, and 7. Ask the interviewer early which they expect.

## Common mistakes

- Coding before agreeing on requirements.
- Designing for the whole world instead of the agreed scope.
- Silent work; interviewers can't grade thinking they don't hear.
- Pattern-stuffing: naming patterns that don't fit to sound senior.
- Running out of time before any flow works end to end.

## In the interview

**Q: How many clarifying questions should I ask?**
Enough to fix scope and remove ambiguity that changes the design, typically 5–8. Then state your assumptions and move on.

**Q: Should I write full code?**
Write the core domain classes and the central flow fully; stub peripheral parts (payment adapters, persistence) behind interfaces and say so.

**Q: How do I show seniority?**
Clear trade-offs, sensible abstraction boundaries, concurrency awareness, and proactive extensibility, not the number of patterns.

## Key takeaways

- Clarify, entities, relationships, diagram, flows, patterns and concurrency, extensibility.
- Agree on scope before designing; state assumptions out loud.
- Get one core flow working end to end before polishing.
- Seniority shows in trade-offs and extensibility, not pattern count.
