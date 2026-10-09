A repository makes persistence look like an in-memory collection of domain objects: `add`, `get`, `find_by...`. Business code asks the repository for entities and never writes SQL or talks to a database client directly.

## The idea

A library's front desk is a repository. You ask for "the book with ISBN X" or "all books by this author", and the librarian returns the books. Whether they're on shelf 3, in storage, or on loan from another branch is the librarian's problem. You deal with books, not shelving systems.

## Why it matters

- **Decoupling**: services depend on a `BookingRepository` interface, not on Postgres or DynamoDB. (Dependency Inversion.)
- **Testability**: an in-memory repository makes tests fast and deterministic.
- **Single place for query logic**: complex queries and mapping between rows and entities live in one class.
- **Interview speed**: you can use in-memory dicts during the interview while showing that the design supports a real database.

Repositories are typically **one per aggregate root** (Order, not OrderLineItem), returning fully formed domain objects.

```python
from dataclasses import dataclass, replace
from datetime import date
from typing import Protocol

@dataclass(frozen=True)
class Reservation:
    reservation_id: str
    hotel_id: str
    room_id: str
    check_in: date
    check_out: date
    version: int = 0

class ReservationRepository(Protocol):
    def add(self, r: Reservation) -> None: ...
    def get(self, reservation_id: str) -> Reservation | None: ...
    def for_room(self, room_id: str, start: date, end: date) -> list[Reservation]: ...
    def update(self, r: Reservation) -> Reservation: ...   # optimistic, by version

class StaleWrite(Exception): ...

class InMemoryReservations:
    def __init__(self) -> None:
        self._rows: dict[str, Reservation] = {}

    def add(self, r: Reservation) -> None:
        if r.reservation_id in self._rows:
            raise KeyError(f"duplicate {r.reservation_id}")
        self._rows[r.reservation_id] = r

    def get(self, reservation_id: str) -> Reservation | None:
        return self._rows.get(reservation_id)

    def for_room(self, room_id: str, start: date, end: date) -> list[Reservation]:
        return [r for r in self._rows.values()
                if r.room_id == room_id and r.check_in < end and start < r.check_out]

    def update(self, r: Reservation) -> Reservation:
        current = self._rows[r.reservation_id]
        if current.version != r.version:
            raise StaleWrite(r.reservation_id)
        saved = replace(r, version=r.version + 1)
        self._rows[r.reservation_id] = saved
        return saved

repo = InMemoryReservations()
repo.add(Reservation("R1", "H1", "101", date(2026, 12, 20), date(2026, 12, 23)))
print(len(repo.for_room("101", date(2026, 12, 22), date(2026, 12, 24))))  # 1 overlap
```

A `SqlReservations` or `DynamoReservations` class would implement the same interface, translating to queries and conditional writes.

## When to use / when not to

Use repositories whenever domain logic needs persistence: almost every LLD problem with entities that are stored (bookings, orders, users, rides). Skip them for read-heavy reporting that doesn't involve domain rules; a dedicated query service or read model is often simpler. Avoid generic `Repository[T]` with 30 methods; tailor each repository to what its aggregate's use cases need.

## Common mistakes

- Leaking query-language details (`find(where="status = 'X'")`) through the interface.
- Repositories per table rather than per aggregate.
- Returning ORM objects or raw rows instead of domain entities.
- Putting business rules in the repository ("save only if the room is free"); the rule belongs in the domain or use case, with the repository providing the atomic primitive (conditional write).
- A generic repository so abstract it can't express the real queries.

## In the interview

**Q: Repository vs DAO?**
A DAO is table-oriented and exposes persistence operations; a repository is domain-oriented, works with aggregates, and speaks the domain's language. In practice the line is blurry, but repositories return domain objects.

**Q: How do you handle transactions across repositories?**
With a Unit of Work that the use case opens and commits, or by designing aggregates so each use case modifies one aggregate atomically.

**Q: Why use in-memory repositories in an interview?**
They keep focus on the design while the interface shows the persistence layer is swappable.

## Key takeaways

- Repositories present storage as a collection of domain objects.
- One repository per aggregate root, with an interface owned by the domain.
- In-memory implementations enable fast tests and focused interviews.
- Keep business rules out; expose atomic primitives like conditional updates.
