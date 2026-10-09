Builder lets you construct a complex object step by step and validate it once at the end, instead of calling a constructor with twelve positional arguments and hoping you got the order right.

## The idea

Ordering a custom pizza: you pick a size, then a crust, then toppings one at a time, and only when you say "done" does the kitchen check the order makes sense (no pineapple on the Jain menu, at most five toppings) and start cooking. The pizza is never half-built in the oven. A Builder collects choices, and `build()` produces a finished, valid, usually immutable object.

## Why it matters

Objects with many optional parts lead to "telescoping constructors" or long keyword lists where invalid combinations are easy to create. A builder:

- Gives readable, named steps.
- Centralises cross-field validation in `build()`.
- Lets the product be **immutable** once built.
- Can provide presets (a "director") for common configurations.

In Python, keyword arguments and dataclasses already solve the simple cases, so reach for a builder when construction has real rules or is assembled incrementally (for example, parsed from a request or a config file).

```python
from dataclasses import dataclass
from typing import Self

@dataclass(frozen=True)
class HttpRequest:
    method: str
    url: str
    headers: tuple[tuple[str, str], ...]
    body: bytes | None
    timeout_s: float
    retries: int

class RequestBuilder:
    def __init__(self, url: str) -> None:
        self._url = url
        self._method = "GET"
        self._headers: dict[str, str] = {}
        self._body: bytes | None = None
        self._timeout, self._retries = 5.0, 0

    def method(self, m: str) -> Self:
        self._method = m.upper()
        return self

    def header(self, k: str, v: str) -> Self:
        self._headers[k] = v
        return self

    def json(self, payload: str) -> Self:
        self._body = payload.encode()
        return self.header("Content-Type", "application/json")

    def retries(self, n: int, timeout_s: float = 5.0) -> Self:
        self._retries, self._timeout = n, timeout_s
        return self

    def build(self) -> HttpRequest:
        if self._method == "GET" and self._body is not None:
            raise ValueError("GET requests cannot have a body")
        if self._retries and self._method == "POST" and "Idempotency-Key" not in self._headers:
            raise ValueError("retried POSTs need an Idempotency-Key")
        return HttpRequest(self._method, self._url, tuple(self._headers.items()),
                           self._body, self._timeout, self._retries)

req = (RequestBuilder("https://api.example.com/orders")
       .method("post").json('{"sku": "A1"}')
       .header("Idempotency-Key", "ord-77").retries(3)
       .build())
print(req.method, req.retries)
```

## When to use / when not to

Use a builder when an object has many optional parameters, cross-field validation rules, or is assembled across several steps. Typical LLD spots: building a `Pizza`/`Meal` order, a search query with filters, a notification with optional attachments, or a game configured with board size, players, and rules. Don't use one for a dataclass with three fields; keyword arguments are already a builder.

## Common mistakes

- Returning a mutable product, so callers can bypass the validation you put in `build()`.
- Validating in each setter only, missing cross-field rules.
- Reusing one builder to create several products and accidentally sharing mutable state (like the headers dict); copy collections in `build()`.
- Adding a builder where Python keyword arguments suffice.

## In the interview

**Q: Why not just use keyword arguments?**
For simple objects, I would. A builder earns its place when there are cross-field rules, incremental assembly, or presets that keyword arguments make awkward.

**Q: What's a Director?**
An optional helper that encodes common build sequences, like `MealDirector.kids_combo(builder)`, so callers don't repeat the steps.

**Q: How does Builder support immutability?**
All mutation happens in the builder; `build()` validates and returns a frozen object, so the product is always valid once it exists.

## Key takeaways

- Builder = step-by-step assembly + one validation point + finished product.
- Return immutable products from `build()`.
- Fluent methods returning `Self` keep it readable.
- Don't use it where keyword arguments are enough.
