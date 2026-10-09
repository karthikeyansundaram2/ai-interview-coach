Error handling is part of the design, not an afterthought. Interviewers notice whether your design says what happens when the payment fails, the slot is taken, or the input is nonsense.

## The idea

A good hospital triage desk sorts problems quickly: a paperwork issue goes back to the patient to fix, a capacity issue gets "please wait or try another branch", and a genuine emergency escalates immediately. Errors in software need the same triage:

| Category | Example | Response |
| --- | --- | --- |
| Invalid input | Negative quantity, end before start | Reject at the boundary, tell the caller exactly what's wrong |
| Business rule violation | Seat already booked, insufficient balance | Domain exception with a clear meaning |
| Transient infrastructure | Timeout, connection reset | Retry with backoff, then fail cleanly |
| Bug / invariant broken | Negative stock after a decrement | Fail loudly; don't hide it |

## Why it matters

Mixing these categories leads to designs that retry business errors forever, swallow bugs, or show users stack traces. A clear exception hierarchy lets callers handle what they understand and let the rest propagate. Combined with idempotency, it makes retries safe.

```python
import random
import time
from typing import Callable, TypeVar

T = TypeVar("T")

class DomainError(Exception):
    """Base for business-rule failures callers are expected to handle."""

class OutOfStock(DomainError):
    def __init__(self, sku: str, requested: int, available: int) -> None:
        super().__init__(f"{sku}: requested {requested}, available {available}")
        self.sku, self.requested, self.available = sku, requested, available

class TransientError(Exception):
    """Infrastructure hiccup; safe to retry if the operation is idempotent."""

def with_retry(op: Callable[[], T], attempts: int = 4, base_delay: float = 0.05) -> T:
    for attempt in range(attempts):
        try:
            return op()
        except TransientError:
            if attempt == attempts - 1:
                raise
            time.sleep(base_delay * 2 ** attempt * random.uniform(0.5, 1.5))  # jitter
    raise AssertionError("unreachable")

class Inventory:
    def __init__(self, stock: dict[str, int]) -> None:
        self._stock = stock

    def reserve(self, sku: str, qty: int) -> None:
        if qty <= 0:
            raise ValueError("qty must be positive")             # invalid input
        available = self._stock.get(sku, 0)
        if qty > available:
            raise OutOfStock(sku, qty, available)                # business rule
        self._stock[sku] = available - qty
        assert self._stock[sku] >= 0, "invariant broken"         # bug guard

inv = Inventory({"tshirt-m": 2})
try:
    with_retry(lambda: inv.reserve("tshirt-m", 3))
except OutOfStock as e:
    print(f"tell user: only {e.available} left")
```

Note that `with_retry` only retries `TransientError`; retrying `OutOfStock` would be pointless.

## When to use / when not to

Define a small domain exception hierarchy for any non-trivial LLD problem, validate at the boundaries (constructors, public methods), and retry only transient, idempotent operations. For multi-step workflows (reserve stock, charge, confirm), plan **compensating actions**: if charging fails, release the reservation.

## Common mistakes

- `except Exception: pass`, which hides bugs.
- Retrying non-idempotent operations, causing double charges.
- Returning `False` or `None` with no reason, forcing callers to guess.
- Leaking infrastructure exceptions (`botocore.ClientError`) into domain code; translate at the adapter.
- No cleanup on partial failure, leaving held seats or reserved stock forever.

## In the interview

**Q: How does your design handle payment failure after seats are held?**
The booking stays `HELD` until the hold expires; on explicit failure we release the hold immediately (compensating action) and the user can retry.

**Q: When do you retry?**
Only for transient failures on idempotent operations, with exponential backoff, jitter, and a cap. Business errors are surfaced, not retried.

**Q: Where do validation errors get raised?**
At the boundary: value object constructors and public service methods, so the core logic can assume valid data.

## Key takeaways

- Classify errors: invalid input, business rule, transient, bug.
- Use a domain exception hierarchy; translate infrastructure errors at adapters.
- Retry only transient errors on idempotent operations, with backoff and jitter.
- Plan compensating actions for multi-step workflows.
