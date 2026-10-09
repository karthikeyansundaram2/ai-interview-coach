Design a movie ticket booking system like BookMyShow: browse movies and shows by city, view the seat map, hold seats while paying, and confirm the booking. Interviewers love it because seat locking under heavy contention is a real concurrency problem.

## Requirements

**Functional**

- Cities have theatres; theatres have screens; screens have a fixed seat layout with categories (Recliner, Prime, Classic).
- Shows: a movie on a screen at a start time, with per-category prices.
- Users browse movies in a city, pick a show, view the live seat map.
- Select up to 10 seats; seats are **held** for the user for ~8 minutes while they pay.
- On payment success, seats become BOOKED and a ticket is issued; on failure or timeout, holds are released.
- Cancel booking (per policy) with refund; seats return to AVAILABLE.

**Non-functional**

- No double booking, even when thousands of users try the same seats at once.
- Seat map reads must be fast.
- Payment and confirmation are idempotent.

## Core entities

| Entity | Responsibility |
| --- | --- |
| `Movie`, `City`, `Theatre`, `Screen` | Catalogue and venue structure |
| `Seat` | Physical seat in a screen: row, number, category |
| `Show` | Movie + screen + start time + pricing; owns per-show seat states |
| `ShowSeat` | Seat state for one show: AVAILABLE, HELD, BOOKED; hold owner and expiry; version |
| `SeatHold` | Hold ID, user, show, seats, expiry |
| `Booking` | Confirmed purchase: seats, amount, payment ref, status |
| `SeatLockManager` | Atomic hold/release/confirm of seats |
| `PricingStrategy` | Category price, weekend/time surcharges, offers |
| `BookingService` | Facade: hold, confirm, cancel |

## Class design

```python
import threading
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Protocol

class SeatStatus(Enum):
    AVAILABLE = "available"
    HELD = "held"
    BOOKED = "booked"

@dataclass(frozen=True)
class Seat:
    seat_id: str          # e.g. "C7"
    category: str

@dataclass
class ShowSeat:
    seat: Seat
    status: SeatStatus = SeatStatus.AVAILABLE
    held_by: str | None = None          # hold id
    hold_expiry: float = 0.0

    def is_free(self, now: float) -> bool:
        return self.status is SeatStatus.AVAILABLE or (
            self.status is SeatStatus.HELD and self.hold_expiry < now)

@dataclass
class Show:
    show_id: str
    movie_id: str
    screen_id: str
    start_ts: float
    prices: dict[str, int]
    seats: dict[str, ShowSeat]            # cloned from the screen's layout (Prototype)
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

@dataclass(frozen=True)
class SeatHold:
    hold_id: str
    user_id: str
    show_id: str
    seat_ids: tuple[str, ...]
    amount: int
    expires_at: float

class SeatUnavailable(Exception): ...

class SeatLockManager:
    def __init__(self, hold_seconds: int = 480) -> None:
        self.hold_seconds = hold_seconds

    def hold(self, show: Show, seat_ids: list[str], user_id: str) -> SeatHold:
        now = time.time()
        with show.lock:                                   # all-or-nothing per show
            if not all(show.seats[s].is_free(now) for s in seat_ids):
                raise SeatUnavailable(seat_ids)
            hold_id = uuid.uuid4().hex
            for s in seat_ids:
                ss = show.seats[s]
                ss.status, ss.held_by, ss.hold_expiry = SeatStatus.HELD, hold_id, now + self.hold_seconds
        amount = sum(show.prices[show.seats[s].seat.category] for s in seat_ids)
        return SeatHold(hold_id, user_id, show.show_id, tuple(seat_ids), amount, now + self.hold_seconds)

    def confirm(self, show: Show, hold: SeatHold) -> bool: ...   # HELD by this hold & unexpired -> BOOKED
    def release(self, show: Show, hold: SeatHold) -> None: ...   # only seats still held by this hold

class PaymentGateway(Protocol):
    def charge(self, user_id: str, amount: int, idempotency_key: str) -> str | None: ...
    def refund(self, payment_ref: str) -> None: ...

@dataclass
class Booking:
    hold: SeatHold
    payment_ref: str
    booking_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    status: str = "CONFIRMED"

class BookingService:
    def __init__(self, shows: dict[str, Show], locks: SeatLockManager, payments: PaymentGateway) -> None:
        self.shows, self.locks, self.payments = shows, locks, payments
        self.bookings: dict[str, Booking] = {}

    def hold_seats(self, user_id: str, show_id: str, seat_ids: list[str]) -> SeatHold: ...
    def pay_and_confirm(self, hold: SeatHold) -> Booking: ...
    def cancel(self, booking_id: str) -> None: ...
```

## Key flows

1. **Browse**: city -> movies -> shows (served from cache). Seat map read without the lock (a snapshot; stale by milliseconds is fine).
2. **Hold seats**: validate count (<= 10) and that seats exist; `locks.hold(...)` atomically checks every seat is free (AVAILABLE, or HELD with an expired hold) and marks them HELD with the new hold ID. Any unavailable seat fails the whole request; the UI refreshes the map.
3. **Pay and confirm**:
   1. Charge with `hold_id` as the idempotency key.
   2. `locks.confirm(show, hold)`: under the show lock, verify every seat is still HELD by this hold and unexpired, then mark BOOKED.
   3. If confirm fails (hold expired and someone else took a seat), refund automatically and tell the user.
   4. Create `Booking`; send ticket asynchronously.
4. **Release**: on payment failure, user cancel, or expiry. Expired holds are released lazily (the `is_free` check) and by a periodic sweeper that also reconciles.
5. **Cancel booking**: per policy, refund; mark seats AVAILABLE under the lock.

## Patterns used

- **Prototype**: each show's seat map is cloned from the screen's layout so states are independent per show.
- **Strategy**: pricing (category, weekday/weekend, offers) and cancellation policies.
- **Facade**: `BookingService` coordinates seat locks and payments.
- **Observer**: seat-map viewers get pushed updates (WebSocket) on seat changes; notifications on booking.
- **State (light)**: `SeatStatus` transitions AVAILABLE -> HELD -> BOOKED and back, enforced in `SeatLockManager`.

## Concurrency & edge cases

- **Lock granularity**: per-show lock serialises holds for one show; contention is limited to that show's buyers. Alternatively, per-seat conditional writes in the DB (`UPDATE show_seat SET status='HELD', hold_id=? WHERE show_id=? AND seat_id IN (...) AND (status='AVAILABLE' OR expiry < now)` and check the affected row count, in one transaction), or Redis `SET NX PX` per seat key with sorted acquisition.
- **Expired holds** are reclaimable without a sweeper because `is_free` treats them as free; the sweeper is just cleanup.
- **Payment succeeds after hold expiry**: confirm fails -> automatic refund. Keep hold TTL a bit longer than the payment page timeout to make this rare.
- **Double clicks / retries** on pay: idempotency key = hold ID.
- **Orphan seats** (single empty seat between bookings): optional rule enforced at hold time.

## Follow-ups the interviewer may ask

**Why hold seats before payment instead of booking directly?**
Payment takes minutes and can fail. Holding with a TTL reserves the seats fairly without permanently blocking them if the user abandons checkout.

**How would you scale for a blockbuster release?**
Shard by show; put a virtual waiting room in front to admit users at a controlled rate; use per-seat atomic operations in Redis for holds, with the DB as the system of record updated on confirmation.

**Distributed lock or DB conditional write?**
Prefer conditional writes in the datastore that owns the seat state, because a separate distributed lock can expire or diverge from the data it protects.
