Coupling is how much one module depends on others; cohesion is how strongly the parts of one module belong together. Good designs aim for low coupling and high cohesion, and most other principles are just specific ways to get there.

## The idea

Think of a well-organised kitchen. Everything for baking lives in one cabinet (high cohesion), and the baking cabinet doesn't depend on the spice rack being arranged a certain way (low coupling). In a badly organised kitchen, flour is in three places and you can't make tea without moving the oven.

**Coupling**, from worst to best:

| Kind | Example |
| --- | --- |
| Content | Class A edits class B's private fields |
| Global / common | Both read and write a shared global dict |
| Control | A passes a flag telling B which branch to run |
| Stamp | A passes a whole object when B needs one field |
| Data | A passes only the primitive values B needs |
| Message / interface | A calls B through an interface |

**Cohesion**, from best to worst: functional (everything serves one task), sequential, communicational, ... down to coincidental (a `utils.py` of unrelated helpers).

## Why it matters

Low coupling means a change stays local. High cohesion means you know where to find and change something. SRP raises cohesion; DIP and Demeter lower coupling; ISP lowers coupling at the interface level. When an interviewer asks "why did you split this class?", the clearest answer is usually in these two words.

```python
from dataclasses import dataclass
from typing import Protocol

# Low cohesion, high coupling (avoid):
# class Utils:
#     def send_email(...)      # messaging
#     def parse_csv(...)       # I/O
#     def calc_gst(...)        # tax rules
#     def resize_image(...)    # media

# High cohesion: everything here is about fares.
@dataclass(frozen=True)
class FareInput:
    distance_km: float
    minutes: float
    surge: float

class FareCalculator:
    BASE, PER_KM, PER_MIN = 50.0, 12.0, 1.5

    def fare(self, f: FareInput) -> int:
        raw = self.BASE + f.distance_km * self.PER_KM + f.minutes * self.PER_MIN
        return round(raw * f.surge)

# Low coupling: trip completion depends on a narrow interface and plain data,
# not on the calculator class or a giant Trip object.
class Fares(Protocol):
    def fare(self, f: FareInput) -> int: ...

def complete_trip(distance_km: float, minutes: float, surge: float, fares: Fares) -> int:
    return fares.fare(FareInput(distance_km, minutes, surge))

print(complete_trip(8.2, 22, 1.2, FareCalculator()))
```

## When to use / when not to

Use these as your default lens when evaluating any design. They're guidelines, not absolutes: zero coupling means nothing collaborates. The goal is that coupling flows through stable, narrow interfaces, and that each module is a coherent concept you could name in two or three words.

## Common mistakes

- `utils`, `helpers`, `common` modules that grow into coincidental-cohesion dumps.
- Passing boolean "mode" flags (control coupling) instead of separate methods or strategies.
- Passing whole aggregates when only an ID or a value is needed (stamp coupling).
- Shared mutable globals that make every module implicitly depend on every other.

## In the interview

**Q: How do you know a class has low cohesion?**
Its methods use disjoint subsets of its fields, or you can't name it without "and" or "manager". Splitting along those subsets usually raises cohesion.

**Q: How do you reduce coupling between two services in your design?**
Depend on a narrow interface owned by the consumer, pass data rather than objects where possible, and use events for one-way notifications so the producer doesn't know its consumers.

**Q: Which matters more?**
They work together. High cohesion naturally lowers coupling because related things stop needing to reach across module boundaries.

## Key takeaways

- Aim for low coupling and high cohesion; most principles serve these two.
- Prefer interface and data coupling over control, global, or content coupling.
- A class you can't name crisply probably has low cohesion.
- Events and narrow interfaces are the strongest decoupling tools.
