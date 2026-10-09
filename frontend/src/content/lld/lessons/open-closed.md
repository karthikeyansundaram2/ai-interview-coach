The Open/Closed Principle says software should be open for extension but closed for modification: when a new requirement arrives, you add a new class instead of editing code that already works and is already tested.

## The idea

A power strip is open/closed. When you buy a new gadget, you plug it into a free socket. You don't rewire the strip. The socket is the **extension point**; the wiring inside stays closed.

In code, the extension point is usually an interface plus some way to register implementations. The "closed" part is the code that consumes the interface.

## Why it matters

Every edit to working code risks a regression. In LLD interviews, the classic follow-up is "now add a new vehicle type / payment method / discount rule". If your answer is "I'll add another `elif`", the interviewer hears "this design does not scale". If your answer is "I'll add a class implementing `DiscountRule`", you've just demonstrated OCP.

Before:

```text
def discount(order):
    if order.coupon == "FESTIVE": ...
    elif order.coupon == "FIRST_ORDER": ...
    elif order.customer.is_prime: ...   # every new rule edits this function
```

After:

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class Order:
    subtotal: int
    coupon: str | None
    is_first_order: bool
    is_prime: bool

class DiscountRule(ABC):
    @abstractmethod
    def applies(self, order: Order) -> bool: ...

    @abstractmethod
    def amount(self, order: Order) -> int: ...

class FestiveCoupon(DiscountRule):
    def applies(self, order: Order) -> bool:
        return order.coupon == "FESTIVE"

    def amount(self, order: Order) -> int:
        return order.subtotal // 10

class FirstOrder(DiscountRule):
    def applies(self, order: Order) -> bool:
        return order.is_first_order

    def amount(self, order: Order) -> int:
        return min(100, order.subtotal)

class DiscountEngine:
    def __init__(self, rules: list[DiscountRule]) -> None:
        self._rules = rules

    def best_discount(self, order: Order) -> int:
        return max((r.amount(order) for r in self._rules if r.applies(order)), default=0)

engine = DiscountEngine([FestiveCoupon(), FirstOrder()])
print(engine.best_discount(Order(1500, "FESTIVE", True, False)))  # 150
```

Adding a `PrimeMember` rule touches zero existing lines; you write a class and add it to the list (ideally in configuration or composition root).

## When to use / when not to

Apply OCP at **known points of variation**: pricing, payment, notification channels, matching algorithms, game rules. Don't try to make everything extensible; you cannot predict every change, and speculative extension points add complexity. A good rule is: the first time, just write it; the second similar case, notice; the third, introduce the abstraction. In interviews, you can name likely variation points up front because the interviewer will ask about them.

## Common mistakes

- Thinking OCP forbids ever editing a file. Fixing bugs and refactoring are fine; OCP is about adding features.
- Replacing the `if` chain with a registry but still switching on type strings elsewhere.
- Creating extension points for things that never vary.
- Forgetting that the composition root (where rules are wired) still changes; that is expected and cheap.

## In the interview

**Q: How does your design handle a new payment method?**
Add a new class implementing `PaymentMethod` and register it with the factory. The checkout flow depends only on the interface, so it doesn't change.

**Q: Which patterns help achieve OCP?**
Strategy, Decorator, Observer, Template Method, and Chain of Responsibility all add behaviour through new classes rather than edits.

**Q: Is a dictionary of handlers an OCP solution?**
Yes, a registry mapping keys to handlers is a lightweight, Pythonic way to stay closed for modification, as long as callers never switch on the keys themselves.

## Key takeaways

- New behaviour should arrive as new code, not edits to tested code.
- Polymorphism plus a registration point is the usual mechanism.
- Apply it at real, likely variation points, not everywhere.
- Interviewers probe OCP with "now add X" follow-ups; plan for them.
