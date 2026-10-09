Decorator wraps an object in another object with the same interface, adding behaviour before or after delegating. You can stack decorators like layers, getting combinations of features without a subclass for every combination.

## The idea

A plain coffee costs Rs 100. Add milk (+20), add an extra shot (+40), add caramel (+30). You don't need a `CoffeeWithMilkAndCaramel` class; each add-on wraps the drink and adjusts the price and description. Because every wrapper looks like a drink, you can wrap in any order and any number of times.

```text
Caramel( ExtraShot( Milk( Espresso ) ) )
   │          │         │       │
   └── each wraps the next and calls inner.cost() ──┘
```

## Why it matters

With inheritance, N optional features need up to 2^N subclasses. Decorators add features independently and at runtime, which follows Open/Closed (new feature = new wrapper) and Single Responsibility (each wrapper does one thing). It's also how cross-cutting concerns like logging, retries, caching, and metrics are layered onto services.

Note: Python's `@decorator` syntax wraps *functions*. The GoF Decorator wraps *objects*. Same spirit, different scope.

```python
import time
from typing import Protocol

class DataSource(Protocol):
    def fetch(self, key: str) -> str: ...

class HttpSource:
    def __init__(self) -> None:
        self.calls = 0

    def fetch(self, key: str) -> str:
        self.calls += 1
        if self.calls == 1:
            raise ConnectionError("flaky network")
        return f"value-for-{key}"

class Retrying:
    def __init__(self, inner: DataSource, attempts: int = 3) -> None:
        self._inner, self._attempts = inner, attempts

    def fetch(self, key: str) -> str:
        for i in range(self._attempts):
            try:
                return self._inner.fetch(key)
            except ConnectionError:
                if i == self._attempts - 1:
                    raise
                time.sleep(0.01 * 2 ** i)
        raise AssertionError("unreachable")

class Caching:
    def __init__(self, inner: DataSource) -> None:
        self._inner, self._cache = inner, {}

    def fetch(self, key: str) -> str:
        if key not in self._cache:
            self._cache[key] = self._inner.fetch(key)
        return self._cache[key]

http = HttpSource()
source: DataSource = Caching(Retrying(http))
print(source.fetch("user:1"), source.fetch("user:1"), http.calls)  # ... 2
```

Order matters: `Caching(Retrying(...))` caches successful results; `Retrying(Caching(...))` would retry around the cache, which is usually pointless.

## When to use / when not to

Use decorators for optional, combinable behaviour on a stable interface: pricing add-ons (toppings, insurance, priority delivery), I/O concerns (retry, cache, logging, rate limiting), and stream processing (compression, encryption). Avoid them when the interface is large (every wrapper must forward every method) or when the stack becomes so deep that debugging which layer did what is painful.

## Common mistakes

- Changing the interface in the wrapper, so it's no longer substitutable.
- Forgetting to forward some methods on a large interface.
- Relying on decorator order without documenting it.
- Using a decorator where a simple Strategy (choose one behaviour) is what's needed.

## In the interview

**Q: Decorator vs inheritance?**
Inheritance fixes the combination at class-definition time and explodes with combinations. Decorators compose features at runtime and each feature is one class.

**Q: Decorator vs Proxy?**
Structurally similar. A decorator adds behaviour the client wants; a proxy controls access to the real object (laziness, permissions, remoteness), often without the client knowing.

**Q: Where in an LLD problem?**
Pizza or coffee pricing with toppings, a notification sender wrapped with retry and rate-limit layers, or a logger wrapped with formatting and filtering.

## Key takeaways

- Same interface, wraps an inner object, adds behaviour around delegation.
- Avoids subclass explosion for combinable features.
- Order of wrapping changes semantics.
- Ideal for cross-cutting concerns like retries and caching.
