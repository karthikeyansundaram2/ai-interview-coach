Layered and clean architectures organise code by responsibility and enforce one rule: dependencies point inward, toward the business logic. The core of your design should not know whether it's called from HTTP or a CLI, or whether data lives in Postgres or DynamoDB.

## The idea

Think of a restaurant. The **dining room** (waiters, menus) talks to customers. The **kitchen** (chefs, recipes) is where the real work happens. The **storeroom and suppliers** provide ingredients. Recipes don't change because the restaurant switched vegetable suppliers or started taking online orders. The kitchen is the core; everything else plugs into it.

```text
 ┌─────────────────────────────────────────────┐
 │ Interface / delivery: controllers, CLI, jobs │
 │  ┌───────────────────────────────────────┐   │
 │  │ Application: use cases / services     │   │
 │  │  ┌─────────────────────────────────┐  │   │
 │  │  │ Domain: entities, value objects,│  │   │
 │  │  │ domain rules, repository ports  │  │   │
 │  │  └─────────────────────────────────┘  │   │
 │  └───────────────────────────────────────┘   │
 │ Infrastructure: DB repos, gateways, queues   │
 └─────────────────────────────────────────────┘
   Dependencies point inward only.
```

## The layers

- **Domain**: entities (`Booking`, `Room`), value objects (`TimeSlot`, `Money`), domain rules, and interfaces (ports) the domain needs, like `BookingRepository`. No framework imports.
- **Application**: use cases (`BookRoom`, `CancelBooking`) that orchestrate domain objects, manage transactions, and call ports.
- **Interface**: HTTP handlers, CLI, consumers. Parse input, call a use case, format output.
- **Infrastructure**: implementations of ports (adapters): SQL repositories, payment gateway clients, message publishers.

Clean, hexagonal (ports and adapters), and onion architecture are variations on this same dependency rule.

```python
# domain.py — no imports from outer layers
from dataclasses import dataclass
from typing import Protocol

@dataclass
class Room:
    room_id: str
    is_booked: bool = False

    def book(self) -> None:
        if self.is_booked:
            raise ValueError("already booked")
        self.is_booked = True

class RoomRepository(Protocol):          # port, owned by the domain
    def get(self, room_id: str) -> Room: ...
    def save(self, room: Room) -> None: ...

# application.py — use case, depends only on domain
class BookRoom:
    def __init__(self, rooms: RoomRepository) -> None:
        self._rooms = rooms

    def __call__(self, room_id: str) -> str:
        room = self._rooms.get(room_id)
        room.book()
        self._rooms.save(room)
        return f"booked {room_id}"

# infrastructure.py — adapter implementing the port
class InMemoryRooms:
    def __init__(self) -> None:
        self._rows: dict[str, Room] = {"101": Room("101")}

    def get(self, room_id: str) -> Room:
        return self._rows[room_id]

    def save(self, room: Room) -> None:
        self._rows[room.room_id] = room

# interface.py — e.g. an HTTP handler
def handle_post_booking(body: dict, use_case: BookRoom) -> dict:
    try:
        return {"status": 200, "message": use_case(body["room_id"])}
    except ValueError as e:
        return {"status": 409, "error": str(e)}

print(handle_post_booking({"room_id": "101"}, BookRoom(InMemoryRooms())))
```

## When to use / when not to

Use this structure for any service with real business rules that will outlive its framework or database. In an LLD interview, you won't write four modules, but saying "domain classes here, a service layer orchestrating them, and repositories behind interfaces" signals maturity. For small scripts or CRUD-only services, a thin two-layer structure is fine; full clean architecture would be overkill.

## Common mistakes

- Business rules in controllers ("fat controllers").
- Domain entities importing ORM base classes or HTTP request objects.
- Anemic domain models: entities with only fields, and every rule in services.
- Defining repository interfaces in the infrastructure package.
- Creating every layer for a trivial app.

## In the interview

**Q: Where does validation go?**
Format validation at the interface layer; business-rule validation in domain entities and value objects, so it applies no matter how the use case is invoked.

**Q: Why does the domain own the repository interface?**
So the domain depends on nothing outward; infrastructure implements the interface, which lets you swap storage and test with in-memory fakes.

**Q: Clean vs hexagonal architecture?**
Same core idea: business logic at the centre, I/O at the edges, dependencies pointing inward. Hexagonal emphasises ports and adapters; clean adds explicit use-case and entity rings.

## Key takeaways

- Domain at the centre, I/O at the edges, dependencies pointing inward.
- Use cases orchestrate; entities enforce rules; adapters do I/O.
- The domain owns its ports; infrastructure implements them.
- Scale the ceremony to the problem.
