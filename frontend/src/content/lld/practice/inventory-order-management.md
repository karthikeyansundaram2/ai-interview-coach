Design an inventory and order management system for an e-commerce store: track stock across warehouses, reserve it when orders are placed, and move orders through payment, fulfilment, and cancellation without overselling. The heart of it is a reservation model plus an order state machine.

## Requirements

**Functional**

- Products (SKUs) with stock per warehouse.
- Customers place orders with multiple line items; stock is **reserved** at checkout and **committed** when payment succeeds.
- Reservations expire if payment isn't completed within 15 minutes.
- Order lifecycle: CREATED -> RESERVED -> PAID -> PACKED -> SHIPPED -> DELIVERED, plus CANCELLED and RETURNED.
- Cancel before shipping releases stock; returns restock after inspection.
- Low-stock alerts to purchasing; admins can adjust stock (restock, damage write-off).

**Non-functional**

- Never oversell, even during a flash sale with heavy contention on one SKU.
- Idempotent order placement and payment callbacks (clients and gateways retry).
- Auditable: every stock change recorded with a reason.

## Core entities

| Entity | Responsibility |
| --- | --- |
| `Product` | SKU, name, price |
| `StockItem` | SKU + warehouse: on-hand, reserved; `available = on_hand - reserved` |
| `Reservation` | Order, SKU, warehouse, qty, expiry, status |
| `Order` | ID, customer, lines, status, totals, idempotency key |
| `OrderLine` | SKU, qty, unit price snapshot |
| `OrderStatus` + transition table | Legal lifecycle moves |
| `InventoryService` | Reserve, commit, release, adjust |
| `WarehouseSelector` (strategy) | Picks the warehouse to fulfil from |
| `OrderService` | Facade: place, pay, cancel, ship |
| `StockLedger` | Append-only audit of stock movements |

## Class design

```python
import threading
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Protocol

class OrderStatus(Enum):
    CREATED, RESERVED, PAID, PACKED, SHIPPED, DELIVERED, CANCELLED, RETURNED = range(8)

ALLOWED: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.CREATED: {OrderStatus.RESERVED, OrderStatus.CANCELLED},
    OrderStatus.RESERVED: {OrderStatus.PAID, OrderStatus.CANCELLED},
    OrderStatus.PAID: {OrderStatus.PACKED, OrderStatus.CANCELLED},
    OrderStatus.PACKED: {OrderStatus.SHIPPED},
    OrderStatus.SHIPPED: {OrderStatus.DELIVERED},
    OrderStatus.DELIVERED: {OrderStatus.RETURNED},
}

@dataclass(frozen=True)
class OrderLine:
    sku: str
    qty: int
    unit_price: int

@dataclass
class Order:
    customer_id: str
    lines: list[OrderLine]
    idempotency_key: str
    order_id: str = field(default_factory=lambda: uuid.uuid4().hex[:10])
    status: OrderStatus = OrderStatus.CREATED

    def transition(self, to: OrderStatus) -> None:
        if to not in ALLOWED.get(self.status, set()):
            raise ValueError(f"{self.status.name} -> {to.name} not allowed")
        self.status = to

@dataclass
class StockItem:
    sku: str
    warehouse_id: str
    on_hand: int
    reserved: int = 0
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    @property
    def available(self) -> int:
        return self.on_hand - self.reserved

@dataclass
class Reservation:
    order_id: str
    sku: str
    warehouse_id: str
    qty: int
    expires_at: float
    active: bool = True

class WarehouseSelector(Protocol):
    def candidates(self, sku: str, qty: int, customer_pincode: str) -> list[StockItem]: ...

class InventoryService:
    def __init__(self, selector: WarehouseSelector, hold_s: int = 900) -> None:
        self._selector, self._hold_s = selector, hold_s
        self.reservations: dict[str, list[Reservation]] = {}

    def reserve(self, order: Order, pincode: str) -> None: ...   # all lines or nothing
    def commit(self, order_id: str) -> None: ...                 # on_hand -= qty, reserved -= qty
    def release(self, order_id: str) -> None: ...                # reserved -= qty
    def expire_stale(self, now: float | None = None) -> int: ...

class PaymentGateway(Protocol):
    def charge(self, order_id: str, amount: int, idempotency_key: str) -> bool: ...

class OrderService:
    def __init__(self, inventory: InventoryService, payments: PaymentGateway) -> None:
        self.inventory, self.payments = inventory, payments
        self.orders: dict[str, Order] = {}
        self.by_key: dict[str, str] = {}

    def place(self, customer_id: str, lines: list[OrderLine], key: str, pincode: str) -> Order: ...
    def on_payment_result(self, order_id: str, success: bool) -> None: ...
    def cancel(self, order_id: str) -> None: ...
```

## Key flows

1. **Place order**:
   1. If `key` already maps to an order, return it (idempotent).
   2. Create `Order(CREATED)`.
   3. `inventory.reserve(order)`: for each line, sorted by SKU to avoid deadlocks, lock the chosen `StockItem`, check `available >= qty`, increment `reserved`, create a `Reservation` with expiry. If any line fails, release the ones already reserved and raise `OutOfStock`.
   4. Transition to RESERVED; return the order with a payment link.
2. **Payment callback** (idempotent):
   1. If already PAID or CANCELLED, ignore.
   2. On success: `inventory.commit(order_id)` (on-hand and reserved both decrease), transition to PAID, publish `OrderPaid` for fulfilment.
   3. On failure: release reservations, transition to CANCELLED.
3. **Expiry sweeper**: periodically release active reservations past `expires_at` and cancel their orders.
4. **Cancel**: allowed until PACKED; release reservations if RESERVED, or restock and refund if PAID.
5. **Ship / deliver / return**: driven by warehouse events; returns re-add stock after QC with a ledger entry.

## Patterns used

- **State (transition table)**: `ALLOWED` makes legal moves explicit; illegal transitions raise.
- **Strategy**: `WarehouseSelector` (nearest to customer, most stock, cheapest shipping).
- **Facade**: `OrderService` coordinates inventory and payments.
- **Observer / events**: `OrderPaid`, `LowStock`, `OrderShipped` feed fulfilment, purchasing, and notifications.
- **Saga (compensating actions)**: reserve -> pay -> commit; failures trigger release and refund instead of a distributed transaction.

## Concurrency & edge cases

- **Overselling**: the check-and-reserve is atomic per `StockItem` (lock, or `UPDATE stock SET reserved = reserved + :q WHERE sku = :s AND on_hand - reserved >= :q`).
- **Multi-line orders**: lock in a consistent order (sorted SKU) and roll back partial reservations.
- **Hot SKU in a flash sale**: a single row becomes a bottleneck; split stock into N buckets (sub-counters) and reserve from any bucket, or queue reservations through a single consumer for that SKU.
- **Payment arrives after reservation expiry**: if stock is still available, re-reserve and commit; otherwise refund automatically.
- **Duplicate callbacks** from the gateway: idempotent handling by order status.
- **Ledger**: every change (`reserve`, `commit`, `release`, `adjust`) writes an entry for audits and reconciliation.

## Follow-ups the interviewer may ask

**Why separate reserved from on-hand?**
It lets you hold stock for in-flight checkouts without losing track of physical inventory, and makes expiry and cancellation simple: just decrement `reserved`.

**Reserve at add-to-cart or at checkout?**
At checkout. Reserving at cart time locks stock for window-shoppers; most stores reserve at checkout with a short TTL.

**How would you split an order across warehouses?**
The selector returns a fulfilment plan of (warehouse, qty) pairs; each becomes a separate reservation and shipment, and the order tracks per-shipment status.

**How do you keep search's "in stock" badge accurate?**
Publish stock-change events to update a read-optimised availability index; it can be slightly stale because the reservation step is the real check.
