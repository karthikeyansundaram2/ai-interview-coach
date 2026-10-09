Frameworks are easier to trust once you've seen one applied. Here's the seven-step approach run on a real prompt, "Design a parking lot", with timings and the traps that cost candidates the most.

## The prompt and the first five minutes

Think of this like a cooking show: the dish is simple, but watching the order of operations is the lesson.

**Clarify (0–5 min).** A strong candidate asks and writes down:

- Multiple floors? *Yes.* Vehicle types? *Bike, car, truck.* Spot types? *Small, compact, large; a bike can use any, a car compact or large, a truck only large.*
- Entry/exit gates? *Multiple, so concurrent.* Payment? *Hourly, by vehicle type, paid at exit.*
- Out of scope: reservations, EV charging, valet. *Agreed, but design so they're addable.*

## Entities, relationships, diagram (5–18 min)

```text
ParkingLot ◆── 1..* Floor ◆── * Spot
ParkingLot ──> SpotAllocator <<interface>>      (NearestFirst, ...)
ParkingLot ──> PricingStrategy <<interface>>    (HourlyPricing, ...)
Ticket ──> Spot, Vehicle        Vehicle: plate, VehicleType
EntryGate / ExitGate ──> ParkingLot (facade)
Enums: VehicleType, SpotSize, TicketStatus
```

Narrate the decisions: floors are composed into the lot; allocation and pricing are strategies because the interviewer will ask to change them; a `FITS` table maps vehicle types to spot sizes instead of a vehicle class hierarchy, since vehicles have no behaviour beyond their type.

## Core flow in code (18–33 min)

```python
import threading
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

class VehicleType(Enum):
    BIKE = 1
    CAR = 2
    TRUCK = 3

class SpotSize(Enum):
    SMALL = 1
    COMPACT = 2
    LARGE = 3

FITS = {VehicleType.BIKE: [SpotSize.SMALL, SpotSize.COMPACT, SpotSize.LARGE],
        VehicleType.CAR: [SpotSize.COMPACT, SpotSize.LARGE],
        VehicleType.TRUCK: [SpotSize.LARGE]}

@dataclass
class Spot:
    spot_id: str
    size: SpotSize
    plate: str | None = None

@dataclass(frozen=True)
class Ticket:
    ticket_id: str
    spot_id: str
    vehicle_type: VehicleType
    entry: datetime

class ParkingLot:
    def __init__(self, spots: list[Spot]) -> None:
        self._free = {s: [sp for sp in spots if sp.size is s] for s in SpotSize}
        self._lock = threading.Lock()
        self._seq = 0

    def park(self, plate: str, vt: VehicleType, now: datetime) -> Ticket:
        with self._lock:                                   # atomic allocate
            for size in FITS[vt]:                          # smallest fitting first
                if self._free[size]:
                    spot = self._free[size].pop()
                    spot.plate = plate
                    self._seq += 1
                    return Ticket(f"T{self._seq}", spot.spot_id, vt, now)
        raise RuntimeError("lot full for this vehicle type")
```

Unpark mirrors it: look up the spot, free it under the lock, and compute the fee through `PricingStrategy`.

## Patterns, concurrency, extensibility (33–45 min)

- **Strategy** for pricing and allocation; **Facade** for gates; **Factory** if vehicles gain behaviour.
- **Concurrency**: allocation is check-then-act, so it is locked. Per-size locks would reduce contention; across servers, a conditional write per spot.
- **Extensions**: EV spots become a new `SpotSize` plus a `FITS` entry; reservations become a `Reservation` entity that pre-assigns a spot; a display board observes spot changes (**Observer**).

## When to use / when not to

Use this walkthrough as a rehearsal template: run any practice problem through the same timings, out loud. Don't treat the timings as rigid; if the interviewer wants code early, shrink the diagram step.

## Common mistakes

- **Deep inheritance for data-only differences** (`Car(Vehicle)`, `Bike(Vehicle)` with no behaviour).
- **The silent 10 minutes**, coding without narrating.
- **Ignoring the second gate**, missing the concurrency question entirely.
- **Singleton ParkingLot**, which the interviewer will challenge.
- **No end-to-end flow** at the 40-minute mark.
- **Over-clarifying**: 15 minutes of questions leaves no time to design.

## In the interview

**Q: Why not a Vehicle class hierarchy?**
Vehicles differ only by type here, so an enum plus a fit table is simpler and adding a type is a data change. If vehicles gained behaviour, I'd introduce classes.

**Q: How would you find a spot faster on a huge lot?**
Keep free spots per size in queues or heaps per floor (nearest first), so allocation is O(1) or O(log n) instead of scanning.

**Q: What if the interviewer changes requirements mid-way?**
Welcome it: show which classes absorb the change. That's the extensibility test.

## Key takeaways

- Time-box each step; one working core flow beats a perfect diagram.
- Narrate decisions and trade-offs continuously.
- Use enums and tables for data-only variation, classes for behavioural variation.
- Always raise concurrency and extensibility yourself before you're asked.
