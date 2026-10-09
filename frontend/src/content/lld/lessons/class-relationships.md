Association, aggregation, and composition all mean "these objects are connected", but they differ in ownership and lifetime. Naming the right one shows the interviewer you've thought about who creates, who owns, and who deletes.

## The idea

Consider a university. A **professor teaches courses**: they know each other, but neither owns the other (association). A **department has professors**: if the department is dissolved, professors still exist and move elsewhere (aggregation). A **building has rooms**: demolish the building and the rooms are gone too (composition).

| Relationship | Meaning | Lifetime | Typical Python shape |
| --- | --- | --- | --- |
| Association | A knows/uses B | Independent | Field holding a reference, often passed in |
| Aggregation | A groups B (whole/part, weak) | Parts outlive whole | Collection of objects created elsewhere |
| Composition | A owns B (whole/part, strong) | Parts die with whole | Parts created inside A, never shared |
| Dependency | A uses B temporarily | N/A | B is a method parameter or local |

**Multiplicity** completes the picture: `1`, `0..1`, `*`, `1..*`. "A show has exactly one screen; a screen has many shows" is `Show * ── 1 Screen`.

## Why it matters

These choices answer real design questions: when a hotel is deleted, are its rooms deleted? Can a seat belong to two screens? Who is responsible for creating the line items? They determine constructors, cascading deletes, and where invariants are enforced. Composition in particular defines an **aggregate**: the owner is the only entry point for modifying its parts, which is where you put consistency rules and locks.

```python
from dataclasses import dataclass, field

@dataclass
class Professor:
    name: str

@dataclass
class Course:
    code: str
    instructor: Professor | None = None     # association, 0..1

@dataclass
class Department:
    name: str
    members: list[Professor] = field(default_factory=list)  # aggregation, *

    def hire(self, prof: Professor) -> None:
        self.members.append(prof)            # created elsewhere, shared

@dataclass
class Room:
    number: str
    capacity: int

class Building:
    def __init__(self, name: str, layout: dict[str, int]) -> None:
        self.name = name
        # composition: rooms are created by, and only reachable through, Building
        self._rooms = {num: Room(num, cap) for num, cap in layout.items()}

    def capacity(self) -> int:
        return sum(r.capacity for r in self._rooms.values())

alice = Professor("Alice")
cs = Department("CS")
cs.hire(alice)
algo = Course("CS201", instructor=alice)
print(Building("Block A", {"101": 60, "102": 40}).capacity())  # 100
```

## When to use / when not to

Use **composition** when parts make no sense alone and invariants span the whole (an order and its line items, a board and its cells). Use **aggregation** for groupings of independent entities (a team and its players). Use **association** for peers that reference each other (a booking references a guest). Don't agonise over aggregation versus association in an interview; the important distinction is whether the owner controls the part's lifetime.

## Common mistakes

- Making everything composition, so deleting a department deletes its professors.
- Bidirectional references everywhere (`room.building` and `building.rooms`), which complicates consistency; add the back-reference only if a flow needs it.
- Exposing composed parts for external mutation, breaking the aggregate's invariants.
- Omitting multiplicity, leaving "one or many?" ambiguous.

## In the interview

**Q: Is the relationship between Order and LineItem aggregation or composition?**
Composition: line items have no meaning without their order and should be modified only through it so totals stay consistent.

**Q: Between Driver and Vehicle?**
Association or aggregation: a vehicle exists independently and a driver may switch vehicles, so neither owns the other's lifetime.

**Q: Why does this matter for code?**
It decides who constructs objects, who exposes mutation methods, and what cascades on delete, which affects both correctness and locking scope.

## Key takeaways

- Association knows, aggregation groups, composition owns.
- Lifetime and ownership are the real questions.
- Composed parts are mutated only through their owner.
- Always state multiplicity.
