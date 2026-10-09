Design a parking lot with multiple floors, different spot sizes, entry and exit gates, and hourly pricing. It's the most-asked LLD problem, so interviewers expect clean allocation logic, pluggable pricing, and a real answer about two cars racing for the last spot.

## Requirements

**Functional**

- Multiple floors, each with spots of size SMALL, COMPACT, LARGE (plus optional EV and HANDICAPPED).
- Vehicle types: BIKE, CAR, TRUCK (plus EV variants); each fits certain spot sizes.
- Entry gate: allocate a suitable spot and issue a ticket; reject if full.
- Exit gate: compute fee from duration and vehicle type, accept payment, free the spot.
- Display board shows free spots per floor and type.
- Admin can add/remove floors and spots, mark spots out of service.

**Non-functional**

- Multiple gates operate concurrently; a spot is never double-allocated.
- Allocation should be fast: O(1) or O(log n), not a full scan.
- Pricing and allocation rules change often; they must be pluggable.

## Core entities

| Entity | Responsibility |
| --- | --- |
| `VehicleType`, `SpotSize` (enums) | Kinds of vehicles and spots, plus a fit table |
| `Vehicle` | Plate and type (value object) |
| `ParkingSpot` | ID, floor, size, occupied-by |
| `Floor` | Spots grouped by size, free-spot pools |
| `Ticket` | ID, plate, spot, entry time, status |
| `AllocationStrategy` | Picks a spot (nearest first, fill lowest floor, spread load) |
| `PricingStrategy` | Computes fee (hourly, flat, weekend) |
| `PaymentProcessor` | Cash/card/UPI behind an interface |
| `ParkingLot` | Facade: park, unpark, availability |

## Class design

```python
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from math import ceil

class VehicleType(Enum):
    BIKE = "bike"
    CAR = "car"
    TRUCK = "truck"

class SpotSize(Enum):
    SMALL = 1
    COMPACT = 2
    LARGE = 3

FITS: dict[VehicleType, list[SpotSize]] = {
    VehicleType.BIKE: [SpotSize.SMALL, SpotSize.COMPACT, SpotSize.LARGE],
    VehicleType.CAR: [SpotSize.COMPACT, SpotSize.LARGE],
    VehicleType.TRUCK: [SpotSize.LARGE],
}

@dataclass(frozen=True)
class Vehicle:
    plate: str
    type: VehicleType

@dataclass
class ParkingSpot:
    spot_id: str
    floor: int
    size: SpotSize
    plate: str | None = None

@dataclass
class Floor:
    number: int
    free: dict[SpotSize, list[ParkingSpot]] = field(default_factory=dict)  # stacks of free spots

@dataclass
class Ticket:
    ticket_id: str
    vehicle: Vehicle
    spot: ParkingSpot
    entry: datetime
    exit: datetime | None = None
    fee: int | None = None

class AllocationStrategy(ABC):
    @abstractmethod
    def allocate(self, floors: list[Floor], vt: VehicleType) -> ParkingSpot | None: ...

class LowestFloorFirst(AllocationStrategy):
    def allocate(self, floors: list[Floor], vt: VehicleType) -> ParkingSpot | None:
        for floor in floors:
            for size in FITS[vt]:                   # smallest fitting size first
                if floor.free.get(size):
                    return floor.free[size].pop()
        return None

class PricingStrategy(ABC):
    @abstractmethod
    def fee(self, ticket: Ticket, exit_time: datetime) -> int: ...

class HourlyPricing(PricingStrategy):
    RATE = {VehicleType.BIKE: 20, VehicleType.CAR: 50, VehicleType.TRUCK: 100}

    def fee(self, ticket: Ticket, exit_time: datetime) -> int:
        hours = max(1, ceil((exit_time - ticket.entry).total_seconds() / 3600))
        return hours * self.RATE[ticket.vehicle.type]

class PaymentProcessor(ABC):
    @abstractmethod
    def pay(self, ticket_id: str, amount: int) -> bool: ...

class ParkingLot:
    def __init__(self, floors: list[Floor], allocator: AllocationStrategy,
                 pricing: PricingStrategy, payments: PaymentProcessor) -> None:
        self._floors, self._allocator = floors, allocator
        self._pricing, self._payments = pricing, payments
        self._active: dict[str, Ticket] = {}
        self._lock = threading.Lock()
        self._seq = 0

    def park(self, vehicle: Vehicle, now: datetime) -> Ticket: ...
    def unpark(self, ticket_id: str, now: datetime) -> int: ...
    def availability(self) -> dict[int, dict[SpotSize, int]]: ...
```

## Key flows

1. **Entry / park**:
   1. Gate scans the plate and type, calls `lot.park(vehicle, now)`.
   2. Under the lock: `spot = allocator.allocate(floors, vehicle.type)`; if `None`, raise `LotFull`.
   3. Set `spot.plate`, create `Ticket`, store in `_active`; release the lock.
   4. Publish a `SpotChanged` event to update the display board.
2. **Exit / unpark**:
   1. Look up the ticket; compute `fee = pricing.fee(ticket, now)` (outside the lock; it's pure).
   2. `payments.pay(ticket_id, fee)`; on failure, keep the ticket active and let the driver retry.
   3. Under the lock: clear `spot.plate`, push the spot back onto its floor's free stack, remove the ticket from `_active`.
   4. Publish `SpotChanged`.
3. **Availability**: count free stacks per floor and size; can be cached and updated by events.

## Patterns used

- **Strategy**: `AllocationStrategy` (lowest floor, nearest to gate, EV priority) and `PricingStrategy` (hourly, flat event pricing, weekend).
- **Facade**: `ParkingLot` is the single entry point for gates.
- **Observer**: display boards and analytics subscribe to spot-change events.
- **Factory**: build floors and spots from a layout config; create payment processors by method.
- Deliberate choice: vehicle types are an enum plus a fit table, not a class hierarchy, because vehicles have no behaviour beyond their type. Introduce classes if they gain behaviour.

## Concurrency & edge cases

- **Two gates, last spot**: allocation is check-then-act. Free-spot pools are mutated only under a lock; finer-grained locks per floor and size reduce contention. Across multiple servers, store spots in a DB and claim with a conditional update (`UPDATE spot SET plate=? WHERE id=? AND plate IS NULL`).
- **Payment outside the lock**: never hold the allocation lock across a payment call.
- **Lost ticket**: look up by plate, charge a maximum-day fee.
- **Spot goes out of service while occupied**: mark it and exclude it from pools after the vehicle leaves.
- **Clock issues**: compute durations from server time at the gates, not the client.
- **Overnight stays and pricing across tariff boundaries**: pricing strategies can split the interval.

## Follow-ups the interviewer may ask

**How would you add EV charging spots?**
Add `SpotSize.EV` (or an `ev` flag) and extend `FITS` for EV vehicles; add a charging fee component as a pricing decorator. Allocation can prefer EV spots for EVs.

**How do you make allocation faster on a huge lot?**
Keep free spots in per-floor, per-size stacks or min-heaps keyed by distance to the gate; allocation is O(1) or O(log n).

**Why not make ParkingLot a singleton?**
Supporting multiple lots (a chain) becomes trivial when the lot is injected, and tests can create isolated lots.

**How do you support reservations?**
Add a `Reservation` with a time window and a pre-assigned spot removed from the free pool during that window; entry validates the reservation instead of allocating.

**How would you handle multiple entrances with nearest-spot allocation?**
Maintain one heap per entrance ordered by distance; when a spot is taken, lazily discard it from other heaps when it surfaces (check occupancy on pop).
