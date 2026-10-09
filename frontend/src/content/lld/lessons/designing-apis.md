A design is only as good as the interface other code uses to talk to it. Good APIs make the right call obvious and the wrong call hard, whether they're Python method signatures or service endpoints.

## The idea

A well-designed microwave has a "30 seconds" button for the common case and a keypad for the rest. It won't start with the door open. You don't need the manual to use it correctly. A good API is the same: **easy to use correctly, hard to use incorrectly**, with the common case shortest.

## Principles that matter in LLD

- **Speak the domain.** `book_seats(show_id, seat_ids, user_id)` beats `update(entity, op="book")`.
- **Use types to prevent mistakes.** Enums over magic strings, value objects over raw primitives (`Money`, `TimeSlot`), frozen dataclasses for results.
- **Make illegal states unrepresentable.** If a booking needs at least one seat, validate at construction.
- **Command-query separation.** Methods either change state or return data, not both (with pragmatic exceptions like `pop`).
- **Return rich results, raise meaningful errors.** Don't return `None` for "failed for one of five reasons".
- **Idempotency for mutations** that might be retried: accept a client-supplied request ID.
- **Narrow inputs, stable outputs.** Accept the minimum you need; return objects you can extend without breaking callers.

```python
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

class RoomUnavailable(Exception): ...

@dataclass(frozen=True)
class TimeSlot:
    start: datetime
    end: datetime

    def __post_init__(self) -> None:
        if self.end <= self.start:
            raise ValueError("slot must end after it starts")

    def overlaps(self, other: "TimeSlot") -> bool:
        return self.start < other.end and other.start < self.end

class BookingStatus(Enum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"

@dataclass(frozen=True)
class Booking:
    booking_id: str
    room_id: str
    slot: TimeSlot
    status: BookingStatus

class RoomScheduler:
    def __init__(self) -> None:
        self._bookings: dict[str, list[Booking]] = {}
        self._by_request: dict[str, Booking] = {}

    def book(self, room_id: str, slot: TimeSlot, request_id: str) -> Booking:
        """Command: idempotent on request_id. Raises RoomUnavailable on conflict."""
        if request_id in self._by_request:
            return self._by_request[request_id]          # safe retry
        existing = self._bookings.setdefault(room_id, [])
        if any(b.slot.overlaps(slot) and b.status is BookingStatus.CONFIRMED for b in existing):
            raise RoomUnavailable(room_id)
        booking = Booking(f"bk-{len(self._by_request) + 1}", room_id, slot, BookingStatus.CONFIRMED)
        existing.append(booking)
        self._by_request[request_id] = booking
        return booking

    def is_free(self, room_id: str, slot: TimeSlot) -> bool:
        """Query: no side effects."""
        return not any(b.slot.overlaps(slot) for b in self._bookings.get(room_id, []))
```

`TimeSlot` validates itself, so no method ever receives a backwards slot. `book` is idempotent, raises a specific error, and returns an immutable result.

## When to use / when not to

Apply these when defining the public methods of your main classes in an interview; the signatures on your class diagram *are* your API. You don't need value objects for every primitive; use them where validation or behaviour belongs (money, time ranges, coordinates, quantities).

## Common mistakes

- Boolean flag parameters (`book(room, slot, True, False)`); use separate methods or enums.
- Returning `None` or `-1` on failure instead of raising a domain exception.
- Accepting entire objects when an ID is all you need, creating coupling.
- Methods that both mutate and return unrelated data, making retries unsafe.
- Using `float` for money.

## In the interview

**Q: How do you make a booking API safe to retry?**
Accept a client-generated idempotency key, store the result keyed by it, and return the stored result on repeat calls.

**Q: Exceptions or result objects?**
In Python, domain exceptions for business failures are idiomatic. Result objects make sense when failure is a common, expected outcome the caller always handles, like a search returning no matches.

**Q: What does "make illegal states unrepresentable" mean here?**
Validate invariants in constructors of value objects and entities so invalid instances can't exist, rather than checking in every method that uses them.

## Key takeaways

- Easy to use correctly, hard to use incorrectly.
- Domain names, enums, and value objects prevent whole classes of bugs.
- Separate commands from queries; make commands idempotent where retried.
- Raise specific domain errors instead of returning sentinels.
