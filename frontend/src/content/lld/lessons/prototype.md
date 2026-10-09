Prototype creates new objects by copying an existing, pre-configured one instead of building from scratch. It shines when setup is expensive or when you want many slight variations of a template.

## The idea

A teacher prepares one master worksheet, then photocopies it for the class. Each student writes on their own copy; nobody redraws the worksheet. The master is the **prototype**, and copying is cheaper and less error-prone than recreating it.

## Why it matters

- **Expensive initialisation**: if building an object needs parsing, network calls, or heavy computation, cloning a ready instance is faster.
- **Configured templates**: a "standard seat map" for a screen, a "default game board", or a "base notification" that many variants start from.
- **Decoupling from concrete classes**: a registry of prototypes lets clients create objects by name without knowing their classes.

In Python, the `copy` module does the heavy lifting. The key decision is **shallow vs deep copy**: a shallow copy shares nested mutable objects with the original, which is the classic bug.

```python
import copy
from dataclasses import dataclass, field

@dataclass
class Seat:
    row: str
    number: int
    category: str
    booked: bool = False

@dataclass
class SeatMap:
    screen: str
    seats: list[Seat] = field(default_factory=list)

    def clone(self) -> "SeatMap":
        return copy.deepcopy(self)   # each show gets independent seats

def build_standard_layout(screen: str) -> SeatMap:
    # pretend this is expensive: reading a layout file, validating aisles, etc.
    seats = [Seat(r, n, "premium" if r in "AB" else "regular")
             for r in "ABCDE" for n in range(1, 11)]
    return SeatMap(screen, seats)

class SeatMapRegistry:
    def __init__(self) -> None:
        self._prototypes: dict[str, SeatMap] = {}

    def register(self, key: str, proto: SeatMap) -> None:
        self._prototypes[key] = proto

    def create(self, key: str) -> SeatMap:
        return self._prototypes[key].clone()

registry = SeatMapRegistry()
registry.register("audi-1", build_standard_layout("Audi 1"))

evening = registry.create("audi-1")
night = registry.create("audi-1")
evening.seats[0].booked = True
print(evening.seats[0].booked, night.seats[0].booked)  # True False
```

With `copy.copy` instead of `deepcopy`, booking a seat in the evening show would also book it in the night show, because both maps would share the same `Seat` objects.

## When to use / when not to

Use Prototype when creating an object is costly or involves many configuration steps, and you need many similar instances. It's a natural fit for per-show seat maps, per-game boards, and document templates. Avoid it when constructors are cheap and simple, or when objects hold resources that can't be meaningfully copied (open sockets, locks, file handles).

## Common mistakes

- Shallow copying objects with nested mutable state.
- Deep copying objects that contain locks, connections, or large shared read-only data; customise `__deepcopy__` to share immutable parts and skip resources.
- Forgetting to reset identity fields (IDs, timestamps) on the clone.
- Using it as a substitute for a proper factory when construction isn't actually expensive.

## In the interview

**Q: Shallow vs deep copy?**
A shallow copy duplicates the top-level object but shares nested objects; a deep copy recursively duplicates everything. Use deep copy when clones must be independently mutable.

**Q: Where would Prototype fit in BookMyShow?**
Each screen has a fixed layout; each show clones that layout so seat booking states are independent per show.

**Q: How do you avoid deep-copying heavy shared data?**
Override `__deepcopy__` to copy only mutable per-instance state and keep references to immutable shared data.

## Key takeaways

- Prototype = clone a configured template instead of rebuilding.
- Deep vs shallow copy is the critical decision.
- A prototype registry decouples clients from concrete classes.
- Don't clone resources like locks or connections.
