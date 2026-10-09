Booking problems (seats, rooms, slots, inventory) all hinge on one question: how do you stop two people from buying the same thing? Pessimistic locking blocks others while you work; optimistic locking lets everyone proceed and rejects the loser at commit time.

## The idea

**Pessimistic**: you put a "reserved" sign on a library book while you decide whether to borrow it. Nobody else can even pick it up. Safe, but if you dawdle, others wait.

**Optimistic**: anyone can pick up the book; when you go to the desk, the librarian checks whether it's still the same copy you picked up (nobody checked it out in between). If not, you retry. Fast when collisions are rare; wasteful when they're common.

## Why it matters

- **Pessimistic** (row locks, `SELECT ... FOR UPDATE`, in-process locks) guarantees exclusivity but reduces throughput and risks deadlocks and long waits.
- **Optimistic** (a `version` column, compare-and-set, conditional writes like DynamoDB's `ConditionExpression`) has no waiting, scales well, and works across servers, but requires retries when conflicts happen.

Booking systems usually combine the idea with a **temporary hold**: mark seats as `HELD` with an expiry so users can complete payment, and release them automatically if they don't.

```python
import threading
import time
from dataclasses import dataclass

class ConflictError(Exception):
    pass

@dataclass
class SeatRecord:
    seat_id: str
    status: str = "AVAILABLE"   # AVAILABLE | HELD | BOOKED
    held_by: str | None = None
    hold_expiry: float = 0.0
    version: int = 0

class SeatStore:
    """Simulates a datastore with conditional (compare-and-set) writes."""

    def __init__(self, seats: list[str]) -> None:
        self._rows = {s: SeatRecord(s) for s in seats}
        self._lock = threading.Lock()   # stands in for the DB's atomic CAS

    def read(self, seat_id: str) -> SeatRecord:
        r = self._rows[seat_id]
        return SeatRecord(**vars(r))     # snapshot, like a DB read

    def compare_and_set(self, new: SeatRecord, expected_version: int) -> None:
        with self._lock:
            if self._rows[new.seat_id].version != expected_version:
                raise ConflictError(new.seat_id)
            new.version = expected_version + 1
            self._rows[new.seat_id] = new

def hold_seat(store: SeatStore, seat_id: str, user: str, ttl_s: float = 300) -> bool:
    snap = store.read(seat_id)
    now = time.time()
    expired_hold = snap.status == "HELD" and snap.hold_expiry < now
    if snap.status != "AVAILABLE" and not expired_hold:
        return False
    snap.status, snap.held_by, snap.hold_expiry = "HELD", user, now + ttl_s
    try:
        store.compare_and_set(snap, expected_version=snap.version)
        return True
    except ConflictError:
        return False        # someone else won; caller shows "seat taken"

store = SeatStore(["A1"])
print(hold_seat(store, "A1", "karthi"), hold_seat(store, "A1", "priya"))  # True False
```

## When to use / when not to

Prefer **optimistic** when contention is low to moderate and operations are short: most bookings, inventory decrements, profile updates. Prefer **pessimistic** when contention is high and retries would thrash (a flash sale on one item), or when the critical section must include several reads that must stay consistent. For multi-item bookings (several seats), lock or CAS items in a consistent sorted order, or use a single transaction, so you don't end up holding half a booking.

## Common mistakes

- Reading availability, then writing without any condition (the classic double-booking bug).
- Holds that never expire, permanently locking inventory when users abandon checkout.
- Retrying optimistic conflicts forever without backoff or a limit.
- Holding pessimistic locks across payment gateway calls.

## In the interview

**Q: How do you prevent double-booking in BookMyShow?**
Seat hold with a TTL using a conditional write (only if `AVAILABLE` or hold expired). Payment confirms `HELD -> BOOKED` with another conditional write; expired holds are released lazily or by a sweeper.

**Q: Optimistic or pessimistic for a hotel room?**
Optimistic with a version per room-date; conflicts are rare and it works across app servers without distributed locks.

**Q: What if two seats must be booked together?**
Use a single transaction or acquire seats in sorted order and roll back held seats if any fails.

## Key takeaways

- Pessimistic: block others first. Optimistic: detect conflicts at write time.
- Conditional writes with a version number are the backbone of optimistic locking.
- Temporary holds with expiry make checkout flows safe.
- Never hold locks across slow external calls.
