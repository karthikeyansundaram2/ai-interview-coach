Design a ride-sharing service like Uber or Ola: riders request trips, the system matches nearby drivers, and trips move through a lifecycle to payment and ratings. The LLD focus is on driver matching, the trip state machine, pricing strategies, and race conditions when multiple riders want the same driver.

## Requirements

**Functional**

- Riders request a ride with pickup, drop, and vehicle type (Bike, Auto, Mini, Sedan).
- Show a fare estimate before confirming (base + distance + time, with surge).
- Match the request to a nearby available driver; driver accepts or declines within 15 seconds; on decline/timeout, try the next driver.
- Trip lifecycle: REQUESTED -> DRIVER_ASSIGNED -> DRIVER_ARRIVED -> IN_PROGRESS -> COMPLETED, plus CANCELLED (by rider or driver).
- Drivers go online/offline and stream location updates.
- Payment on completion (wallet, card, cash); mutual ratings.

**Non-functional**

- A driver must never be assigned to two trips at once.
- Matching should feel instant (< a few seconds) in dense areas.
- Location updates are high-volume; nearby-driver lookup must be efficient.
- Matching and pricing algorithms are swappable per city.

## Core entities

| Entity | Responsibility |
| --- | --- |
| `Location` | Lat/lng value object, distance |
| `Rider`, `Driver` | Profiles; driver has vehicle, status, location, rating |
| `DriverStatus` | OFFLINE, AVAILABLE, OFFERED, ON_TRIP |
| `RideRequest` | Rider, pickup, drop, vehicle type, idempotency key |
| `Trip` | Request, driver, status, fare, timestamps; transition rules |
| `LocationIndex` | Geohash/grid index of available drivers |
| `MatchingStrategy` | Ranks candidate drivers |
| `PricingStrategy` | Fare estimate and final fare |
| `TripService` | Facade: request, accept, start, end, cancel |

## Class design

```python
import math
import threading
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum

@dataclass(frozen=True)
class Location:
    lat: float
    lng: float

    def km_to(self, o: "Location") -> float:
        return math.dist((self.lat, self.lng), (o.lat, o.lng)) * 111   # rough, fine for LLD

class DriverStatus(Enum):
    OFFLINE, AVAILABLE, OFFERED, ON_TRIP = range(4)

@dataclass
class Driver:
    driver_id: str
    vehicle_type: str
    location: Location
    rating: float = 5.0
    status: DriverStatus = DriverStatus.OFFLINE
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def try_reserve(self) -> bool:
        with self.lock:                       # AVAILABLE -> OFFERED, atomically
            if self.status is not DriverStatus.AVAILABLE:
                return False
            self.status = DriverStatus.OFFERED
            return True

class TripStatus(Enum):
    REQUESTED, ASSIGNED, ARRIVED, IN_PROGRESS, COMPLETED, CANCELLED = range(6)

TRANSITIONS = {
    TripStatus.REQUESTED: {TripStatus.ASSIGNED, TripStatus.CANCELLED},
    TripStatus.ASSIGNED: {TripStatus.ARRIVED, TripStatus.CANCELLED},
    TripStatus.ARRIVED: {TripStatus.IN_PROGRESS, TripStatus.CANCELLED},
    TripStatus.IN_PROGRESS: {TripStatus.COMPLETED},
}

@dataclass
class Trip:
    rider_id: str
    pickup: Location
    drop: Location
    vehicle_type: str
    trip_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    driver_id: str | None = None
    status: TripStatus = TripStatus.REQUESTED

    def move_to(self, new: TripStatus) -> None:
        if new not in TRANSITIONS.get(self.status, set()):
            raise ValueError(f"{self.status.name} -> {new.name} not allowed")
        self.status = new

class LocationIndex:
    """Grid cells (~1 km) -> driver ids; a geohash or H3 index in production."""

    def update(self, driver_id: str, old: Location | None, new: Location) -> None: ...
    def nearby(self, loc: Location, rings: int = 2) -> set[str]: ...

class MatchingStrategy(ABC):
    @abstractmethod
    def rank(self, trip: Trip, candidates: list[Driver]) -> list[Driver]: ...

class NearestHighRated(MatchingStrategy):
    def rank(self, trip: Trip, candidates: list[Driver]) -> list[Driver]:
        return sorted(candidates, key=lambda d: (d.location.km_to(trip.pickup), -d.rating))

class PricingStrategy(ABC):
    @abstractmethod
    def estimate(self, trip: Trip, surge: float) -> int: ...

class TripService:
    def __init__(self, drivers: dict[str, Driver], index: LocationIndex,
                 matcher: MatchingStrategy, pricing: PricingStrategy) -> None:
        self.drivers, self.index, self.matcher, self.pricing = drivers, index, matcher, pricing
        self.trips: dict[str, Trip] = {}

    def request(self, rider_id: str, pickup: Location, drop: Location, vtype: str) -> Trip: ...
    def dispatch(self, trip: Trip) -> None: ...            # offer to ranked drivers one by one
    def driver_response(self, trip_id: str, driver_id: str, accepted: bool) -> None: ...
    def complete(self, trip_id: str, distance_km: float, minutes: float) -> int: ...
    def cancel(self, trip_id: str, by: str) -> None: ...
```

## Key flows

1. **Estimate and request**: pricing computes an estimate with current surge for the pickup area; rider confirms; create `Trip(REQUESTED)` (idempotent per request key).
2. **Dispatch**:
   1. `candidates = index.nearby(pickup)` filtered by vehicle type and AVAILABLE status.
   2. `ranked = matcher.rank(trip, candidates)`.
   3. For each driver: `driver.try_reserve()` (atomic AVAILABLE -> OFFERED); if it succeeds, send the offer and wait up to 15 s.
   4. On accept: trip ASSIGNED, driver ON_TRIP. On decline/timeout: driver back to AVAILABLE, try the next. Expand search radius if the list is exhausted; give up after a limit.
3. **Arrive and start**: driver marks ARRIVED; rider shares OTP; trip IN_PROGRESS.
4. **Complete**: compute final fare from actual distance/time with the surge locked at request time; charge payment; driver AVAILABLE; prompt ratings.
5. **Cancel**: allowed before IN_PROGRESS; cancellation fee policy applies after a grace period; driver released.

## Patterns used

- **Strategy**: `MatchingStrategy` (nearest, best-rated, batched matching) and `PricingStrategy` (per city, per vehicle type, surge).
- **State (transition table)**: `TRANSITIONS` guards the trip lifecycle; driver status is a second small state machine.
- **Observer**: rider app gets driver location and status updates; analytics and notifications subscribe to trip events.
- **Facade**: `TripService` exposes the use cases.
- **Factory**: vehicle-type-specific pricing and matching configuration per city.

## Concurrency & edge cases

- **Driver double-assignment**: two dispatchers offering the same driver to two riders. `try_reserve` is an atomic compare-and-set on driver status (in production, a conditional write in the DB or Redis).
- **Accept after timeout**: the offer has expired and the driver was released; reject the late accept by checking the offer ID.
- **Location update volume**: drivers update every few seconds; the index updates only on cell changes, and readers tolerate slightly stale positions.
- **Rider cancels while dispatching**: dispatch loop checks trip status before each offer.
- **Network loss mid-trip**: trip state on the server is authoritative; the app resyncs.

## Follow-ups the interviewer may ask

**How do you find nearby drivers efficiently?**
Bucket drivers into geohash or H3 cells; search the pickup cell and neighbouring rings, expanding until you have enough candidates. That's O(drivers in nearby cells), not O(all drivers).

**Offer one driver at a time or broadcast?**
Sequential offers avoid wasted driver attention and races; broadcasting to a few drivers is faster but needs first-accept-wins with atomic assignment.

**How does surge pricing work?**
Per area, compute demand/supply over a short window; map the ratio to a multiplier with caps. Lock the multiplier into the trip at request time.

**How would you add ride pooling?**
A pooled trip has multiple riders and a route with ordered pickups and drops; matching checks detour constraints. Model `Trip` as containing multiple `RideRequest`s.
