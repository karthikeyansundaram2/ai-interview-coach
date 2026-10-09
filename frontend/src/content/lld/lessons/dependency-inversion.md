The Dependency Inversion Principle says high-level policy should not depend on low-level details; both should depend on abstractions. In practice: your business logic talks to interfaces, and concrete databases, gateways, and clocks are plugged in from outside.

## The idea

A wall socket doesn't care whether electricity comes from coal, solar, or a generator. Your appliances depend on the socket standard, and the power source also conforms to that standard. Neither side depends directly on the other. If the city switches to solar, you don't rewire your kettle.

"Inversion" refers to ownership: the **high-level module owns the interface**, and the low-level module implements it. The dependency arrow points from detail to abstraction, the opposite of naive layering.

```text
Naive:      BookingService ──> MySQLBookingStore

Inverted:   BookingService ──> BookingStore (interface)
                                     ^
                                     │ implements
                             MySQLBookingStore
```

## Why it matters

- **Swap infrastructure** (MySQL to DynamoDB) without touching business rules.
- **Test business logic** with in-memory fakes, fast and deterministic.
- **Stable core**: the most important code depends on the least volatile things.

The usual mechanism is **dependency injection**: pass dependencies into the constructor instead of creating them inside.

```python
from dataclasses import dataclass
from typing import Protocol

@dataclass
class Booking:
    booking_id: str
    room_id: str
    guest: str

class BookingStore(Protocol):
    def is_free(self, room_id: str) -> bool: ...
    def add(self, booking: Booking) -> None: ...

class IdGenerator(Protocol):
    def next_id(self) -> str: ...

class BookingService:
    def __init__(self, store: BookingStore, ids: IdGenerator) -> None:
        self._store = store   # injected, never constructed here
        self._ids = ids

    def book(self, room_id: str, guest: str) -> Booking:
        if not self._store.is_free(room_id):
            raise ValueError(f"room {room_id} is taken")
        booking = Booking(self._ids.next_id(), room_id, guest)
        self._store.add(booking)
        return booking

class InMemoryStore:
    def __init__(self) -> None:
        self._by_room: dict[str, Booking] = {}

    def is_free(self, room_id: str) -> bool:
        return room_id not in self._by_room

    def add(self, booking: Booking) -> None:
        self._by_room[booking.room_id] = booking

class SeqIds:
    def __init__(self) -> None:
        self._n = 0

    def next_id(self) -> str:
        self._n += 1
        return f"B{self._n}"

# Composition root: the only place that knows concrete classes.
service = BookingService(InMemoryStore(), SeqIds())
print(service.book("101", "karthi"))
```

## When to use / when not to

Apply DIP at boundaries with I/O and volatile dependencies: storage, external APIs, message brokers, clocks, random number generators. Don't inject stable, pure utilities like `math` or a value object; that's noise. You don't need a DI framework in Python; constructor injection plus one composition root is plenty.

## Common mistakes

- Constructing dependencies inside methods (`self.db = MySQL()`), which welds the class to infrastructure.
- Defining the interface in the infrastructure package, so the domain still imports infrastructure.
- Confusing DIP (a design principle) with DI (a technique) or IoC containers (a tool).
- Using a global singleton as a hidden dependency instead of injecting it.

## In the interview

**Q: What's the difference between dependency inversion and dependency injection?**
DIP is the principle that policy depends on abstractions; DI is the technique of passing those abstractions in from outside. DI is the usual way to achieve DIP.

**Q: Who owns the interface?**
The high-level module. `BookingStore` lives with the booking domain, and the MySQL adapter implements it from the outer layer.

**Q: How does this help in an LLD round?**
It lets you say "storage is behind a repository interface; I'll use an in-memory implementation now, and the service won't change when we move to a real database".

## Key takeaways

- Business logic depends on interfaces it owns; details implement them.
- Inject dependencies through constructors; wire them in one composition root.
- Invert dependencies on I/O and volatile things, not on stable pure code.
- DIP enables fast tests and painless infrastructure swaps.
