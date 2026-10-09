An interface is a promise: "anything of this type can do these things". Python gives you two ways to write that promise down, abstract base classes and protocols, and knowing when to use which is a small but telling signal of Python fluency.

## The idea

A power socket is an interface. Any appliance with the right plug works, whether it is a kettle or a laptop charger. The socket does not care about brand; it cares about shape.

- **`abc.ABC`** is like a certified plug standard: you must explicitly declare "I implement this" by inheriting, and Python refuses to instantiate a class that has not implemented every `@abstractmethod`.
- **`typing.Protocol`** is like checking the shape of the plug: any class with matching methods satisfies it, no inheritance needed. Type checkers (mypy, pyright) verify it statically.

## Why it matters

Interfaces are how you apply Dependency Inversion: high-level code depends on the contract, and low-level classes plug in. In interviews, writing the interface first shows you are thinking about boundaries and extensibility before implementation.

```python
from abc import ABC, abstractmethod
from typing import Protocol, runtime_checkable

# Nominal: implementers must inherit. Good when you share base behaviour.
class PricingRule(ABC):
    def apply(self, base: int) -> int:
        price = self.adjust(base)
        return max(price, 0)  # shared guard every rule gets for free

    @abstractmethod
    def adjust(self, base: int) -> int: ...

class FlatDiscount(PricingRule):
    def __init__(self, off: int) -> None:
        self.off = off

    def adjust(self, base: int) -> int:
        return base - self.off

# Structural: anything with the right method fits. Good for plug-in seams.
@runtime_checkable
class Clock(Protocol):
    def now_ms(self) -> int: ...

class SystemClock:
    def now_ms(self) -> int:
        import time
        return int(time.time() * 1000)

class FrozenClock:
    def __init__(self, t: int) -> None:
        self.t = t

    def now_ms(self) -> int:
        return self.t

def is_expired(created_ms: int, ttl_ms: int, clock: Clock) -> bool:
    return clock.now_ms() - created_ms > ttl_ms

print(FlatDiscount(50).apply(30))                # 0, guard applied
print(is_expired(0, 100, FrozenClock(500)))     # True
print(isinstance(SystemClock(), Clock))         # True (runtime_checkable)
```

## When to use / when not to

| Use | When |
| --- | --- |
| `ABC` | You want to enforce implementation at instantiation, or share template behaviour (like `apply` above). |
| `Protocol` | You want a lightweight seam, especially for third-party classes you cannot make inherit, or test fakes. |
| Neither | A plain function or callable (`Callable[[int], int]`) is enough for single-method behaviour. |

## Common mistakes

- Putting many unrelated methods into one ABC, forcing implementers to stub some out (violates Interface Segregation).
- Forgetting that `Protocol` checks are static; `isinstance` only works with `@runtime_checkable`, and even then only checks method names, not signatures.
- Using an ABC for a one-method strategy where a callable would be simpler.
- Adding state and heavy logic to an ABC until it becomes a god base class.

## In the interview

**Q: ABC vs Protocol, which do you pick?**
ABC when I want to enforce the contract at runtime or share behaviour across implementations; Protocol when I want structural typing and zero coupling, such as for clocks, repositories, or external clients.

**Q: Does Python have interfaces?**
Not as a keyword, but ABCs and Protocols provide the same design value: an explicit, checkable contract that decouples callers from implementations.

**Q: How do interfaces help testing?**
You can pass a fake implementation (like `FrozenClock`) to make time-dependent or I/O-dependent logic deterministic.

## Key takeaways

- ABCs are nominal and enforced at instantiation; Protocols are structural and checked statically.
- Define the interface before the implementation in interviews.
- Keep interfaces small and focused.
- A `Callable` is often the simplest interface of all.
