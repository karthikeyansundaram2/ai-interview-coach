Strategy puts each variant of an algorithm in its own class behind a shared interface, so the code that uses the algorithm can swap it without changing. It's the single most useful pattern in LLD interviews.

## The idea

To get to the airport you can take a cab, the metro, or drive. The goal is the same; the method differs by budget, time, and traffic. A navigation app lets you pick the strategy and computes the route accordingly, without rewriting the app for each mode.

```text
  Context ──────> <<interface>> Strategy
 (uses one)            + execute()
                    ▲      ▲       ▲
               StratA   StratB   StratC
```

## Why it matters

Whenever an interviewer says "different pricing for weekends", "multiple payment methods", "several matching algorithms", or "different eviction policies", they're inviting a Strategy. It:

- Replaces conditionals with polymorphism (Open/Closed).
- Isolates each algorithm for testing.
- Allows runtime selection, from config or per request.

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime

@dataclass(frozen=True)
class Ticket:
    vehicle_type: str
    entry: datetime

class PricingStrategy(ABC):
    @abstractmethod
    def fee(self, ticket: Ticket, exit_time: datetime) -> int: ...

class HourlyPricing(PricingStrategy):
    RATES = {"bike": 20, "car": 50, "truck": 100}

    def fee(self, ticket: Ticket, exit_time: datetime) -> int:
        hours = max(1, -(-int((exit_time - ticket.entry).total_seconds()) // 3600))
        return hours * self.RATES[ticket.vehicle_type]

class FlatEventPricing(PricingStrategy):
    def __init__(self, flat: int) -> None:
        self.flat = flat

    def fee(self, ticket: Ticket, exit_time: datetime) -> int:
        return self.flat

class ExitGate:
    def __init__(self, pricing: PricingStrategy) -> None:
        self._pricing = pricing

    def set_pricing(self, pricing: PricingStrategy) -> None:
        self._pricing = pricing          # swap at runtime, e.g. on event days

    def checkout(self, ticket: Ticket, now: datetime) -> int:
        return self._pricing.fee(ticket, now)

t = Ticket("car", datetime(2026, 10, 9, 9, 0))
gate = ExitGate(HourlyPricing())
print(gate.checkout(t, datetime(2026, 10, 9, 11, 30)))   # 150
gate.set_pricing(FlatEventPricing(300))
print(gate.checkout(t, datetime(2026, 10, 9, 11, 30)))   # 300
```

In Python, a strategy with one method can also just be a function (`Callable[[Ticket, datetime], int]`). Use a class when the strategy has configuration or more than one method.

## When to use / when not to

Use Strategy for any family of interchangeable algorithms: pricing, fare calculation, spot allocation, driver matching, elevator scheduling, cache eviction, rate-limiting algorithms, split types in Splitwise. Don't use it when there's only one algorithm and no hint of variation, or when the variants differ only by a number (a field will do).

## Common mistakes

- Still switching on type to *select* the strategy deep inside business logic; pick it once via a factory or config.
- Strategies that need access to lots of context internals; pass what they need explicitly.
- Confusing Strategy with State: in State, the object switches its own behaviour as its status changes; in Strategy, the client chooses.
- Creating strategy classes where a lambda or function is clearer.

## In the interview

**Q: Strategy vs State?**
Same structure, different intent. Strategy is chosen from outside and represents *how* to do something; State changes internally as the object moves through its lifecycle and represents *what mode* it's in.

**Q: How do you choose the strategy at runtime?**
A factory or registry keyed by configuration or request input, invoked once at the boundary, and the strategy is injected into the context.

**Q: Strategy vs Template Method?**
Strategy uses composition to swap the whole algorithm; Template Method uses inheritance to vary steps within a fixed skeleton. Strategy is usually more flexible.

## Key takeaways

- Strategy = interchangeable algorithms behind one interface, chosen by the client.
- It's the default answer to "what if we add another way to do X?".
- Select the strategy once at the boundary; inject it.
- In Python, single-method strategies can be plain functions.
