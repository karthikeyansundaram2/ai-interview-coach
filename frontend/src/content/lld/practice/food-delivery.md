Design a food delivery platform like Swiggy or Zomato: customers browse restaurants, build a cart, place orders, restaurants accept and prepare them, and delivery agents pick up and deliver. It's a three-sided marketplace, so the design has to coordinate three actors around one order lifecycle.

## Requirements

**Functional**

- Customers search restaurants by location, cuisine, rating; view menus with item availability.
- Cart holds items from **one** restaurant at a time; apply coupons; see bill (items, taxes, delivery fee, packaging).
- Place order and pay (online or cash on delivery).
- Restaurant accepts or rejects; marks food preparing and ready.
- System assigns a nearby delivery agent; agent picks up and delivers.
- Live order tracking with status updates and agent location.
- Cancel before the restaurant starts preparing (full refund); later cancellations follow policy.
- Ratings for restaurant and agent.

**Non-functional**

- An agent carries at most N orders at a time (often 1, or batched 2 from the same restaurant).
- Status updates reach the customer within seconds.
- Assignment and pricing logic swappable per city.
- Idempotent order placement and payment callbacks.

## Core entities

| Entity | Responsibility |
| --- | --- |
| `Restaurant` | Location, open hours, menu, accepting-orders flag |
| `MenuItem` | Price, availability, veg flag |
| `Cart` | Customer, restaurant, line items; enforces single restaurant |
| `Order` | Snapshot of items and prices, bill, status, agent, timestamps |
| `OrderStatus` + transitions | PLACED, ACCEPTED, PREPARING, READY, PICKED_UP, DELIVERED, CANCELLED, REJECTED |
| `DeliveryAgent` | Location, status, active orders |
| `AssignmentStrategy` | Picks the best agent |
| `BillCalculator` / `Coupon` | Pricing components and discounts |
| `OrderEventBus` | Publishes status changes to observers |
| `OrderService` | Facade: place, accept, ready, pickup, deliver, cancel |

## Class design

```python
import threading
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable

class OrderStatus(Enum):
    PLACED, ACCEPTED, PREPARING, READY, PICKED_UP, DELIVERED, CANCELLED, REJECTED = range(8)

S = OrderStatus
NEXT: dict[OrderStatus, set[OrderStatus]] = {
    S.PLACED: {S.ACCEPTED, S.REJECTED, S.CANCELLED},
    S.ACCEPTED: {S.PREPARING, S.CANCELLED},
    S.PREPARING: {S.READY},
    S.READY: {S.PICKED_UP},
    S.PICKED_UP: {S.DELIVERED},
}

@dataclass(frozen=True)
class CartLine:
    item_id: str
    unit_price: int
    qty: int

@dataclass
class Cart:
    customer_id: str
    restaurant_id: str | None = None
    lines: dict[str, CartLine] = field(default_factory=dict)

    def add(self, restaurant_id: str, line: CartLine) -> None:
        if self.restaurant_id not in (None, restaurant_id):
            raise ValueError("cart has items from another restaurant; clear it first")
        self.restaurant_id = restaurant_id
        self.lines[line.item_id] = line

@dataclass
class Order:
    customer_id: str
    restaurant_id: str
    lines: tuple[CartLine, ...]
    total: int
    order_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    status: OrderStatus = OrderStatus.PLACED
    agent_id: str | None = None

class OrderEventBus:
    def __init__(self) -> None:
        self._subs: list[Callable[[Order, OrderStatus], None]] = []

    def subscribe(self, fn: Callable[[Order, OrderStatus], None]) -> None: ...
    def publish(self, order: Order, old: OrderStatus) -> None: ...   # async in production

@dataclass
class DeliveryAgent:
    agent_id: str
    lat: float
    lng: float
    active_orders: set[str] = field(default_factory=set)
    capacity: int = 1
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def try_take(self, order_id: str) -> bool:
        with self.lock:
            if len(self.active_orders) >= self.capacity:
                return False
            self.active_orders.add(order_id)
            return True

class AssignmentStrategy(ABC):
    @abstractmethod
    def rank(self, order: Order, agents: list[DeliveryAgent]) -> list[DeliveryAgent]: ...

class BillCalculator:
    def total(self, cart: Cart, coupon_code: str | None) -> int: ...

class OrderService:
    def __init__(self, bus: OrderEventBus, assign: AssignmentStrategy, billing: BillCalculator) -> None:
        self.bus, self.assign, self.billing = bus, assign, billing
        self.orders: dict[str, Order] = {}
        self._locks: dict[str, threading.Lock] = {}

    def _transition(self, order: Order, to: OrderStatus) -> None: ...  # check NEXT, set, publish

    def place(self, cart: Cart, coupon: str | None, idem_key: str) -> Order: ...
    def restaurant_accept(self, order_id: str, prep_minutes: int) -> None: ...
    def find_agent(self, order: Order, agents: list[DeliveryAgent]) -> DeliveryAgent | None: ...
    def cancel(self, order_id: str, by: str) -> int: ...      # returns refund
```

## Key flows

1. **Build cart**: adding an item from a different restaurant prompts the user to clear the cart; availability re-checked at checkout.
2. **Place order**: validate restaurant open and items available; `billing.total(cart, coupon)`; take payment (idempotent key); snapshot items and prices into an immutable `Order(PLACED)`; notify the restaurant.
3. **Restaurant accepts**: transition to ACCEPTED with an estimated prep time; on reject (or no response in N minutes), REJECTED and auto-refund.
4. **Assign agent** (triggered on ACCEPTED, timed so the agent arrives near ready time):
   1. Candidate agents near the restaurant, online, with spare capacity.
   2. `assign.rank(order, agents)` by distance to restaurant, current load, and direction.
   3. `agent.try_take(order_id)` atomically; offer to the agent; on decline/timeout release and try the next.
5. **Preparing -> Ready -> Picked up -> Delivered**: each actor's app calls the matching transition; every transition publishes an event that updates customer tracking, ETAs, and notifications.
6. **Delivered**: agent freed; payouts calculated for restaurant and agent; rating prompts.

## Patterns used

- **State (transition table)**: `NEXT` enforces the order lifecycle shared by three actors.
- **Observer**: `OrderEventBus` fans out status changes to customer tracking, restaurant dashboard, notifications, and analytics.
- **Strategy**: `AssignmentStrategy` (nearest, batching-aware, fairness for agents) and pricing components (surge delivery fee, coupons).
- **Facade**: `OrderService` is the API all three apps call.
- **Decorator / Chain (billing)**: coupons and fees applied as composable adjustments to the subtotal.

## Concurrency & edge cases

- **Agent assigned twice**: `try_take` is atomic per agent; in production, a conditional update on the agent's row.
- **Concurrent transitions** (customer cancels while restaurant accepts): per-order lock or a conditional status update (`WHERE status = 'PLACED'`), so only one wins.
- **Item goes out of stock after ordering**: restaurant marks partial availability; offer substitution or partial refund.
- **Agent goes offline mid-delivery**: reassign if not yet picked up; otherwise escalate to support.
- **Price changes**: order snapshot keeps the price the customer saw.
- **Payment callback arrives late or twice**: idempotent by order ID.

## Follow-ups the interviewer may ask

**How would you batch two orders for one agent?**
Raise agent capacity to 2 and let the strategy prefer agents already heading to the same restaurant with a compatible drop direction, bounded by an extra-delay limit.

**How do you compute ETAs?**
Prep time estimate plus agent travel to restaurant plus restaurant-to-customer travel, refined continuously as events and locations arrive.

**Why snapshot prices into the order?**
Menus change; the order must reflect exactly what the customer paid for, for billing, refunds, and disputes.

**How would you scale order tracking?**
Publish status and location events to a pub/sub system; a tracking service pushes them to clients over WebSockets, keyed by order ID.
