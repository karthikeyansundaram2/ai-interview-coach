Design a meeting room booking system for an office: find free rooms for a time slot, book without conflicts, and handle recurring meetings and cancellations. The core is interval-overlap logic and making "check availability then book" atomic.

## Requirements

**Functional**

- Rooms have a name, capacity, floor, and amenities (projector, VC).
- Users search for rooms available in a time slot with minimum capacity and amenities.
- Book a room for a slot; reject if it overlaps an existing booking.
- Cancel a booking; organiser-only.
- Recurring meetings (daily/weekly) with a series ID; cancel one occurrence or the whole series.
- Invitees receive notifications; organiser can add/remove invitees.

**Non-functional**

- No double booking under concurrent requests.
- Availability search fast for ~500 rooms and a few weeks of bookings.
- Times stored in UTC; displayed in the user's timezone.

## Core entities

| Entity | Responsibility |
| --- | --- |
| `TimeSlot` | Value object: start, end, overlap check |
| `Room` | ID, name, capacity, amenities |
| `Booking` | ID, room, slot, organiser, invitees, series ID, status |
| `RoomCalendar` | Sorted bookings for one room; conflict check and insert |
| `RoomFilter` / `RoomSelectionStrategy` | Match criteria; pick best room (smallest that fits) |
| `RecurrenceRule` | Expands a pattern into occurrences |
| `SchedulerService` | Facade: search, book, cancel |

## Class design

```python
import bisect
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Protocol

@dataclass(frozen=True, order=True)
class TimeSlot:
    start: datetime
    end: datetime

    def __post_init__(self) -> None:
        if self.end <= self.start:
            raise ValueError("end must be after start")

    def overlaps(self, other: "TimeSlot") -> bool:
        return self.start < other.end and other.start < self.end

@dataclass(frozen=True)
class Room:
    room_id: str
    name: str
    capacity: int
    amenities: frozenset[str] = frozenset()

class BookingStatus(Enum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"

@dataclass
class Booking:
    room_id: str
    slot: TimeSlot
    organiser: str
    invitees: set[str] = field(default_factory=set)
    series_id: str | None = None
    booking_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    status: BookingStatus = BookingStatus.CONFIRMED

class RoomCalendar:
    """Bookings for one room, kept sorted by start time."""

    def __init__(self) -> None:
        self._starts: list[datetime] = []
        self._bookings: list[Booking] = []
        self.lock = threading.Lock()

    def is_free(self, slot: TimeSlot) -> bool:
        i = bisect.bisect_left(self._starts, slot.end)   # bookings starting before slot end
        # only the booking just before i can overlap if bookings don't overlap each other
        return i == 0 or self._bookings[i - 1].slot.end <= slot.start

    def add(self, b: Booking) -> None:
        i = bisect.bisect_left(self._starts, b.slot.start)
        self._starts.insert(i, b.slot.start)
        self._bookings.insert(i, b)

    def remove(self, booking_id: str) -> None: ...

@dataclass(frozen=True)
class RoomQuery:
    slot: TimeSlot
    min_capacity: int
    amenities: frozenset[str] = frozenset()

class RoomSelectionStrategy(Protocol):
    def choose(self, candidates: list[Room], q: RoomQuery) -> Room | None: ...

class SmallestFit:
    def choose(self, candidates: list[Room], q: RoomQuery) -> Room | None:
        return min(candidates, key=lambda r: r.capacity, default=None)

class Notifier(Protocol):
    def booking_changed(self, b: Booking, change: str) -> None: ...

class SchedulerService:
    def __init__(self, rooms: list[Room], selector: RoomSelectionStrategy, notifier: Notifier) -> None:
        self.rooms = {r.room_id: r for r in rooms}
        self.calendars = {r.room_id: RoomCalendar() for r in rooms}
        self.bookings: dict[str, Booking] = {}
        self.selector, self.notifier = selector, notifier

    def search(self, q: RoomQuery) -> list[Room]: ...
    def book(self, room_id: str, slot: TimeSlot, organiser: str, invitees: set[str]) -> Booking: ...
    def book_any(self, q: RoomQuery, organiser: str, invitees: set[str]) -> Booking: ...
    def book_recurring(self, room_id: str, first: TimeSlot, every: timedelta,
                       count: int, organiser: str) -> list[Booking]: ...
    def cancel(self, booking_id: str, by_user: str) -> None: ...
```

## Key flows

1. **Search**: filter rooms by capacity and amenities, then keep those whose calendar `is_free(slot)`; sort by capacity (smallest fit) or proximity.
2. **Book a specific room**: acquire that room's calendar lock; re-check `is_free` (the search result may be stale); `add` the booking; release; notify invitees asynchronously.
3. **Book any suitable room**: iterate candidates from the selector in order; try to book each until one succeeds (a lost race just moves to the next room).
4. **Recurring booking**: expand occurrences; under the room's lock, check *all* occurrences are free, then add them all with a shared `series_id` (all-or-nothing). Optionally offer "book the free ones and report conflicts".
5. **Cancel**: verify organiser; mark CANCELLED and remove from the calendar under the lock; notify invitees.

## Patterns used

- **Strategy**: room selection (smallest fit, nearest floor, amenities score).
- **Value object**: `TimeSlot` encapsulates validation and overlap logic, used everywhere.
- **Observer**: invitees and calendar integrations (Google/Outlook sync) react to booking events.
- **Facade**: `SchedulerService` hides calendars and indexes.
- **Iterator (optional)**: `RecurrenceRule` yields occurrences lazily for open-ended series.

## Concurrency & edge cases

- **Per-room locks** so bookings for different rooms proceed in parallel; never hold two room locks at once in `book_any` (try one at a time) to avoid deadlocks.
- In a database-backed version: a unique/exclusion constraint on (room, time range), e.g. PostgreSQL `EXCLUDE USING gist`, or conditional writes on per-slot rows.
- **Touching intervals**: 10:00-11:00 and 11:00-12:00 don't overlap (half-open intervals `[start, end)`).
- **Timezones and DST**: store UTC; expand recurrences in the organiser's timezone so "every Monday 10 am" stays at 10 am local across DST changes.
- **Long or past bookings**: enforce maximum duration and forbid booking in the past.
- **Ghost meetings**: auto-release rooms if nobody checks in within 10 minutes.

## Follow-ups the interviewer may ask

**How is the overlap check O(log n)?**
Bookings per room are non-overlapping and sorted by start, so only the booking immediately before the new slot's end can overlap; binary search finds it.

**How do you find the minimum number of rooms needed for a set of meetings?**
Sort by start time and use a min-heap of end times; the heap's maximum size is the answer (the classic "meeting rooms II" problem).

**How would you suggest alternative times when a room is busy?**
Merge the room's busy intervals and scan for gaps of the requested length near the desired time; for multi-person meetings, intersect invitees' free intervals too.

**How do you handle editing one occurrence of a series?**
Store it as an exception: a separate booking with the same `series_id` and an `original_start`, overriding that occurrence.
