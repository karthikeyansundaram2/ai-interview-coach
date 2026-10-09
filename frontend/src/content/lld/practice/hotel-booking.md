Design a hotel booking system like a simplified Booking.com or OYO: search hotels by city and dates, see available room types and prices, and book without double-booking. The tricky parts are date-range availability, pricing rules, and concurrency on popular dates.

## Requirements

**Functional**

- Hotels have room types (Deluxe, Suite) with a count of physical rooms and amenities.
- Search by city, check-in and check-out dates, guests; return hotels with available room types and total price.
- Book a room type for a date range; assign a specific room at check-in (or at booking).
- Pricing varies by date (weekend, season, demand) and can include discounts and taxes.
- Cancel with a policy (free until 24 hours before, otherwise one night charged).
- Payment: pay now or pay at hotel.

**Non-functional**

- No overbooking of a room type on any night (unless the hotel explicitly allows an overbooking buffer).
- Search is read-heavy and should be fast; booking must be strongly consistent.
- Booking and payment calls are idempotent.

## Core entities

| Entity | Responsibility |
| --- | --- |
| `Hotel` | ID, city, rating, room types |
| `RoomType` | Hotel, name, capacity, total rooms, base price |
| `Room` | Physical room number of a type |
| `Inventory` (per room type per night) | Total, booked, version |
| `DateRange` | Check-in (inclusive), check-out (exclusive), iterate nights |
| `Booking` | Guest, room type, date range, price breakdown, status |
| `PricingStrategy` / `PriceRule` | Computes nightly prices and the total |
| `CancellationPolicy` | Computes refund on cancellation |
| `BookingService` | Facade: search, quote, book, cancel |

## Class design

```python
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Iterator, Protocol

@dataclass(frozen=True)
class DateRange:
    check_in: date
    check_out: date          # exclusive

    def __post_init__(self) -> None:
        if self.check_out <= self.check_in:
            raise ValueError("check-out must be after check-in")

    def nights(self) -> Iterator[date]:
        d = self.check_in
        while d < self.check_out:
            yield d
            d += timedelta(days=1)

@dataclass(frozen=True)
class RoomType:
    room_type_id: str
    hotel_id: str
    name: str
    capacity: int
    total_rooms: int
    base_price: int

@dataclass
class NightInventory:
    room_type_id: str
    night: date
    total: int
    booked: int = 0
    version: int = 0

@dataclass
class Booking:
    guest_id: str
    room_type_id: str
    stay: DateRange
    total_price: int
    booking_id: str = field(default_factory=lambda: uuid.uuid4().hex[:10])
    status: str = "CONFIRMED"

class PriceRule(ABC):
    @abstractmethod
    def adjust(self, rt: RoomType, night: date, price: int) -> int: ...

class WeekendSurcharge(PriceRule):
    def adjust(self, rt: RoomType, night: date, price: int) -> int:
        return price * 120 // 100 if night.weekday() >= 4 else price

class PricingEngine:
    def __init__(self, rules: list[PriceRule], tax_pct: int = 12) -> None:
        self.rules, self.tax_pct = rules, tax_pct

    def quote(self, rt: RoomType, stay: DateRange) -> int:
        subtotal = 0
        for night in stay.nights():
            price = rt.base_price
            for rule in self.rules:
                price = rule.adjust(rt, night, price)
            subtotal += price
        return subtotal * (100 + self.tax_pct) // 100

class InventoryRepo(Protocol):
    def get(self, room_type_id: str, night: date) -> NightInventory: ...
    def try_book_nights(self, room_type_id: str, stay: DateRange, qty: int) -> bool: ...  # atomic
    def release_nights(self, room_type_id: str, stay: DateRange, qty: int) -> None: ...

class CancellationPolicy(Protocol):
    def refund(self, booking: Booking, cancelled_on: date) -> int: ...

class BookingService:
    def __init__(self, room_types: dict[str, RoomType], inventory: InventoryRepo,
                 pricing: PricingEngine, cancellation: CancellationPolicy) -> None:
        self.room_types, self.inventory = room_types, inventory
        self.pricing, self.cancellation = pricing, cancellation
        self.bookings: dict[str, Booking] = {}

    def search(self, city: str, stay: DateRange, guests: int) -> list[tuple[RoomType, int]]: ...
    def book(self, guest_id: str, room_type_id: str, stay: DateRange, request_id: str) -> Booking: ...
    def cancel(self, booking_id: str, today: date) -> int: ...
```

## Key flows

1. **Search**: find hotels in the city (index by city); for each room type with enough capacity, available = `min(total - booked)` across the stay's nights; if > 0, quote the price. Serve from a cache/read model, accepting slight staleness.
2. **Book**:
   1. Idempotency: if `request_id` was already used, return the existing booking.
   2. Quote the price (show it to the user and lock it for a few minutes).
   3. `inventory.try_book_nights(room_type, stay, 1)`: atomically increment `booked` for *every* night only if all have `booked < total`; otherwise change nothing and return false.
   4. Charge payment (or mark pay-at-hotel); on payment failure release the nights.
   5. Persist the booking, send confirmation.
3. **Cancel**: verify status; compute refund via policy; release nights; mark CANCELLED; refund asynchronously.
4. **Check-in**: assign a specific `Room` of that type that's clean and free.

## Patterns used

- **Strategy / Chain of price rules**: `PriceRule` list (weekend, season, last-minute discount, member discount) applied in order; new rules are new classes.
- **Repository**: `InventoryRepo` hides the conditional-write details of the datastore.
- **Value object**: `DateRange` with half-open semantics and night iteration.
- **Facade**: `BookingService` exposes search, book, cancel.
- **Strategy**: `CancellationPolicy` per rate plan (non-refundable, flexible).

## Concurrency & edge cases

- **Inventory per room type per night**, not per physical room: booking "any Deluxe" doesn't contend on a specific room, and multi-night checks are simple.
- **Atomic multi-night booking**: a DB transaction updating N night rows with `WHERE booked < total` and checking all rows were updated; or optimistic versions per row with retry. Lock rows in date order to avoid deadlocks.
- **Price changes between quote and book**: honour the quote for a short TTL, or re-quote and ask the user to confirm.
- **Check-out day**: a stay from the 10th to the 12th occupies nights 10 and 11 only.
- **Overbooking buffer**: hotels sometimes allow `booked <= total + buffer`; make it a per-room-type setting.

## Follow-ups the interviewer may ask

**Why not lock specific rooms at booking time?**
Guests book a type, not a room. Counting per type per night maximises sellable inventory; specific rooms are assigned at check-in when cleaning status and preferences are known.

**How do you make search fast?**
Precompute availability per hotel per night in a read-optimised store (or cache), updated by booking events; the booking path still does the authoritative atomic check.

**How do you handle a popular hotel on New Year's Eve?**
The night rows are hot. Optimistic writes with a few retries work; if contention is extreme, queue booking requests per room type and process them serially.

**How would you add multiple rooms in one booking?**
`qty > 1` in `try_book_nights`, with the same all-or-nothing semantics; the booking stores line items per room type.
