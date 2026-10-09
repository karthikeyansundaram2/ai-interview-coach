The Single Responsibility Principle says a class should have one reason to change. If a single class changes when the tax rules change, when the email template changes, and when the database changes, it is doing three jobs.

## The idea

A restaurant has a chef, a cashier, and a waiter. You could hire one person to do all three, and in a tiny cafe that works. But when the menu changes, the payment system changes, and the seating plan changes, that one person is the bottleneck for every change. Separate roles mean each change touches one person.

"Responsibility" here means **a source of change**, usually tied to a stakeholder: finance owns invoicing rules, marketing owns email wording, platform owns storage.

## Why it matters

- **Smaller blast radius.** Changing the invoice format cannot break persistence.
- **Easier testing.** You can test pricing without a database or SMTP server.
- **Clearer names.** A class with one job has an obvious name; a class named `OrderManager` is often a smell.

Before, one class with three reasons to change:

```text
OrderService
  - compute_total()     <- finance rules
  - save_to_db()        <- storage
  - send_confirmation() <- messaging
```

After:

```python
from dataclasses import dataclass
from typing import Protocol

@dataclass(frozen=True)
class LineItem:
    sku: str
    unit_price: int
    qty: int

@dataclass
class Order:
    order_id: str
    customer_email: str
    items: list[LineItem]

class PriceCalculator:
    TAX_RATE = 0.18

    def total(self, order: Order) -> int:
        subtotal = sum(i.unit_price * i.qty for i in order.items)
        return round(subtotal * (1 + self.TAX_RATE))

class OrderRepository(Protocol):
    def save(self, order: Order) -> None: ...

class Mailer(Protocol):
    def send(self, to: str, body: str) -> None: ...

class PlaceOrder:
    """Coordinates the use case; delegates each job."""

    def __init__(self, calc: PriceCalculator, repo: OrderRepository, mailer: Mailer) -> None:
        self._calc, self._repo, self._mailer = calc, repo, mailer

    def execute(self, order: Order) -> int:
        total = self._calc.total(order)
        self._repo.save(order)
        self._mailer.send(order.customer_email, f"Order {order.order_id}: Rs {total}")
        return total
```

`PlaceOrder` still touches all three concerns, but only to orchestrate. Its single reason to change is "the steps of placing an order changed".

## When to use / when not to

Apply SRP when a class mixes domain rules with I/O, or serves different stakeholders. Do not split to the point of one-method classes that only make sense together; that scatters a cohesive concept across files. In a 45-minute interview, aim for clearly named classes per concept, not micro-classes.

## Common mistakes

- Interpreting SRP as "one method per class".
- Classes named `Manager`, `Handler`, `Util` that accumulate unrelated methods.
- Entities that know how to save themselves (`order.save()`), mixing domain and persistence.
- Splitting by technical layer only and still leaving business rules tangled inside controllers.

## In the interview

**Q: How do you identify a responsibility?**
Ask who would request a change to this code. If two different groups (finance and marketing) would both edit the class, it has two responsibilities.

**Q: Isn't the orchestrating class violating SRP since it touches everything?**
No. Its job is coordinating the workflow; it delegates the actual rules. Orchestration is itself a single responsibility.

**Q: Can SRP be overdone?**
Yes. Over-splitting kills cohesion and makes simple flows hard to follow. Split along real axes of change.

## Key takeaways

- One class, one reason to change.
- Responsibilities map to sources of change, often stakeholders.
- Separate domain rules from I/O (persistence, messaging).
- Orchestrators are fine; god classes are not.
