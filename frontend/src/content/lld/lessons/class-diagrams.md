A class diagram is the map of your design: boxes for classes, lines for relationships. In an LLD interview you need just enough UML to communicate clearly in a few minutes, not the full specification.

## The idea

An architect's floor plan doesn't show every nail; it shows rooms, doors, and how spaces connect. A good interview class diagram is the same: the main entities, their key fields and methods, and the relationships between them. It's a thinking tool you share with the interviewer, so speed and clarity beat notational purity.

## The notation you actually need

```text
┌───────────────────────────┐
│ ParkingLot                │   <- class name
├───────────────────────────┤
│ - floors: list[Floor]     │   <- fields (- private, + public)
│ - strategy: SpotStrategy  │
├───────────────────────────┤
│ + park(v: Vehicle): Ticket│   <- methods
│ + unpark(t: Ticket): int  │
└───────────────────────────┘

Relationships:
  A ────────> B     association (A uses / knows B)
  A ◇───────> B     aggregation (A holds B, B can live without A)
  A ◆───────> B     composition (A owns B, B dies with A)
  A ────────▷ B     inheritance (A is-a B)
  A - - - - ▷ B     realisation (A implements interface B)
  A - - - - > B     dependency (A uses B transiently, e.g. a parameter)

Multiplicity on the ends:  1   0..1   *   1..*
```

Mark interfaces with `<<interface>>` and abstract classes with `<<abstract>>` or italics.

## Why it matters

The diagram is where the interviewer first sees your thinking about responsibilities and boundaries. It lets them redirect you early ("what about multiple floors?") before you've written code. It also forces you to decide ownership and cardinality, which drives the code.

The diagram maps directly to Python:

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

class SpotStrategy(ABC):                       # <<interface>>
    @abstractmethod
    def pick(self, floors: list["Floor"], size: str) -> "Spot | None": ...

@dataclass
class Spot:
    spot_id: str
    size: str
    occupied: bool = False

@dataclass
class Floor:                                   # ParkingLot ◆── 1..* Floor
    number: int
    spots: list[Spot] = field(default_factory=list)   # Floor ◆── * Spot

class NearestFirst(SpotStrategy):              # realises SpotStrategy
    def pick(self, floors: list[Floor], size: str) -> Spot | None:
        for floor in floors:
            for spot in floor.spots:
                if spot.size == size and not spot.occupied:
                    return spot
        return None

class ParkingLot:
    def __init__(self, floors: list[Floor], strategy: SpotStrategy) -> None:
        self._floors = floors          # composition: lot creates/owns floors
        self._strategy = strategy      # association: strategy is pluggable
```

## When to use / when not to

Draw a class diagram right after you've listed entities, before writing code. Keep it to 6–12 classes; group minor value objects. Use a quick **sequence sketch** (a numbered list of calls is fine) for the one or two most important flows. Skip activity diagrams, state charts (unless the problem is a state machine like a vending machine), and package diagrams.

## Common mistakes

- Spending 15 minutes on perfect notation while the interviewer waits for design decisions.
- Listing every getter and setter instead of behaviour-revealing methods.
- Drawing every class connected to every other, which hides the real structure.
- Forgetting multiplicity, so it's unclear whether a show has one screen or many.
- Not updating the diagram when the design changes during discussion.

## In the interview

**Q: Do I need exact UML?**
No. Interviewers want clear boxes, named relationships, and multiplicities. Say what an arrow means if you're unsure of the symbol.

**Q: How detailed should the methods be?**
Show the public behaviour that drives key flows, with parameter and return types. Skip trivial accessors.

**Q: Should I diagram before or after coding?**
Before. It's cheap to change a box and expensive to change code. Then keep it in sync as you refine.

## Key takeaways

- Boxes with name, key fields, key methods; arrows with clear meaning and multiplicity.
- Six relationship types cover everything you'll need.
- Diagram after listing entities and before coding.
- Clarity and speed matter more than notation purity.
