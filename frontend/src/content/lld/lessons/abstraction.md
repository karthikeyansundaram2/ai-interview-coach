Abstraction is choosing what to show and what to hide: callers see a small, meaningful set of operations and stay blissfully unaware of the machinery underneath. It is how you keep a large system understandable one piece at a time.

## The idea

When you drive a car you use a steering wheel, two pedals, and a gear selector. You do not think about fuel injection timing or ABS valve pulses. The car offers an **abstraction**: a simplified model that is good enough for the job of driving.

Encapsulation and abstraction are related but different. Encapsulation protects state; abstraction decides which concepts are exposed at all. A good abstraction is phrased in the caller's vocabulary ("send a payment"), not the implementer's ("POST to /v2/charges with idempotency key").

## Why it matters

- **Reduced cognitive load.** Callers reason about "charge a card", not HTTP retries.
- **Replaceability.** If callers only know `PaymentGateway.charge`, you can swap Stripe for Razorpay.
- **Testability.** You can hand a fake implementation to tests.
- **Stable boundaries.** Details churn; the abstraction should not.

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass(frozen=True)
class ChargeResult:
    success: bool
    reference: str

class PaymentGateway(ABC):
    @abstractmethod
    def charge(self, customer_id: str, amount_paise: int) -> ChargeResult:
        """Charge the customer; must be idempotent per (customer, amount, call)."""

class RazorpayGateway(PaymentGateway):
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def charge(self, customer_id: str, amount_paise: int) -> ChargeResult:
        # signing, HTTP calls, retries and response parsing hidden here
        return ChargeResult(success=True, reference="rzp_123")

class FakeGateway(PaymentGateway):
    def __init__(self) -> None:
        self.calls: list[tuple[str, int]] = []

    def charge(self, customer_id: str, amount_paise: int) -> ChargeResult:
        self.calls.append((customer_id, amount_paise))
        return ChargeResult(success=True, reference="fake")

class CheckoutService:
    def __init__(self, gateway: PaymentGateway) -> None:
        self._gateway = gateway

    def pay(self, customer_id: str, amount_paise: int) -> str:
        result = self._gateway.charge(customer_id, amount_paise)
        if not result.success:
            raise RuntimeError("payment declined")
        return result.reference
```

`CheckoutService` is written entirely against the abstraction. It does not know which gateway it has.

## When to use / when not to

Introduce an abstraction at a **real seam**: an external system, a part that has more than one plausible implementation, or a boundary between teams or layers. Do not wrap every class in an interface "just in case". An abstraction with exactly one implementation and no test fake is usually just indirection.

## Common mistakes

- **Leaky abstractions.** Methods like `charge(..., http_timeout=...)` expose implementation details through the interface.
- **Abstracting too early.** Designing a generic `Processor[T]` before you have two concrete cases.
- **Wrong level.** Mixing high-level and low-level operations in one interface (`place_order` next to `set_tcp_keepalive`).
- **Naming after the implementation**, e.g. `RedisStore` as the interface name instead of `SessionStore`.

## In the interview

**Q: What is the difference between abstraction and encapsulation?**
Abstraction decides which operations and concepts are visible; encapsulation protects the internal state behind those operations. You usually use both together.

**Q: How do you decide where to put an abstraction in an LLD problem?**
At points of variation (payment methods, pricing rules, notification channels) and at boundaries with external systems. Those are exactly where interviewers ask "what if we add X?".

**Q: Isn't an interface with one implementation wasteful?**
Often, yes. It earns its keep when it isolates an external dependency or enables a test fake; otherwise add it later when the second case appears.

## Key takeaways

- Abstraction exposes the caller's vocabulary and hides mechanism.
- Place abstractions at points of variation and external boundaries.
- Watch for leaks: implementation details in signatures defeat the purpose.
- Don't abstract speculatively; wait for a real seam.
