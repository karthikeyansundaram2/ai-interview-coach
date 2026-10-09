Facade offers one simple, high-level entry point to a complicated subsystem. Clients call one method; the facade coordinates the many classes behind it.

## The idea

When you check into a hotel, the receptionist handles everything: verifying your booking, assigning a room, issuing a key card, telling housekeeping, and charging your card. You don't visit five departments. The receptionist is a **facade** over the hotel's internal subsystems.

```text
        Client
          │
          ▼
   ┌──────────────┐
   │ CheckInFacade │
   └──────┬───────┘
     ┌────┼─────────┬────────────┐
     ▼    ▼         ▼            ▼
 Bookings Rooms  KeyCards   Payments
```

## Why it matters

Complex subsystems expose many fine-grained classes. If every client orchestrates them, the workflow logic is duplicated and every client is coupled to every subsystem class. A facade:

- Reduces coupling: clients depend on one class.
- Gives a natural home to the **use-case workflow**.
- Makes the subsystem easier to evolve, since only the facade knows its internals.

It doesn't *hide* the subsystem; advanced clients can still use the parts directly.

```python
from dataclasses import dataclass

class BookingRegistry:
    def find(self, booking_ref: str) -> dict:
        return {"ref": booking_ref, "room_type": "deluxe", "guest": "Karthi"}

class RoomAllocator:
    def allocate(self, room_type: str) -> str:
        return "504"

class KeyCardService:
    def issue(self, room_no: str, guest: str) -> str:
        return f"card-{room_no}-{guest.lower()}"

class PaymentService:
    def preauthorise(self, guest: str, amount: int) -> bool:
        return amount <= 20_000

@dataclass(frozen=True)
class CheckInResult:
    room_no: str
    key_card: str

class CheckInFacade:
    def __init__(self, bookings: BookingRegistry, rooms: RoomAllocator,
                 cards: KeyCardService, payments: PaymentService) -> None:
        self._bookings, self._rooms = bookings, rooms
        self._cards, self._payments = cards, payments

    def check_in(self, booking_ref: str, deposit: int) -> CheckInResult:
        booking = self._bookings.find(booking_ref)
        if not self._payments.preauthorise(booking["guest"], deposit):
            raise RuntimeError("deposit authorisation failed")
        room = self._rooms.allocate(booking["room_type"])
        card = self._cards.issue(room, booking["guest"])
        return CheckInResult(room, card)

desk = CheckInFacade(BookingRegistry(), RoomAllocator(), KeyCardService(), PaymentService())
print(desk.check_in("BK-1001", deposit=5_000))
```

## When to use / when not to

Use a facade to give clients a clean API for a common workflow: placing an order, booking a ticket, starting a game. In LLD interviews, your top-level `ParkingLotSystem` or `BookingService` often *is* a facade, and naming it that way shows intent. Don't let the facade become a god class that also contains all the business rules; it should orchestrate, delegating rules to the subsystem.

## Common mistakes

- Turning the facade into a dumping ground for logic that belongs in domain classes.
- Forcing every client through the facade even when they need fine-grained control.
- One giant facade for the whole system instead of one per cohesive use-case area.
- Confusing it with Adapter: the facade simplifies; it doesn't translate an existing interface.

## In the interview

**Q: Isn't a facade just a service class?**
Often, yes. An application service that orchestrates domain objects for a use case is a facade. The pattern name signals that its job is simplification and coordination.

**Q: How do you stop it becoming a god class?**
Keep rules in the domain objects and subsystems; the facade only sequences calls, handles transactions, and maps results.

**Q: Facade vs Mediator?**
A facade is one-directional: clients call it, it calls subsystems. A mediator coordinates two-way communication between peers that otherwise would talk to each other directly.

## Key takeaways

- Facade = one simple entry point over a complex subsystem.
- It orchestrates; domain classes still own the rules.
- Your top-level system class in LLD is usually a facade.
- It simplifies access without forbidding direct use of parts.
