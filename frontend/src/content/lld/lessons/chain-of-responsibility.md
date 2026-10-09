Chain of Responsibility passes a request through a sequence of handlers. Each handler either deals with it, rejects it, or passes it to the next, so the sender never needs to know which handler finally acts.

## The idea

When you raise an expense claim, a team lead can approve up to Rs 10,000, a manager up to Rs 1 lakh, and a director anything above. You submit to your lead; if it's beyond their limit, it moves up automatically. You don't decide who approves; the chain does.

```text
Request ──> [Auth] ──> [RateLimit] ──> [Validation] ──> [Handler]
              │             │               │
           reject        reject          reject
```

There are two flavours:

- **Classic**: exactly one handler processes the request (approval escalation, ATM note dispensing).
- **Pipeline / middleware**: every handler does its part and passes it on, any may short-circuit (web middleware, logging filters).

## Why it matters

Without a chain, one function contains every check in sequence, and adding or reordering a step means editing it. With a chain, each step is a small, testable class, and the order is configuration. It's Open/Closed and Single Responsibility applied to request processing.

```python
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class Withdrawal:
    amount: int
    dispensed: dict[int, int]

class NoteHandler(ABC):
    def __init__(self) -> None:
        self._next: NoteHandler | None = None

    def then(self, nxt: NoteHandler) -> NoteHandler:
        self._next = nxt
        return nxt

    def handle(self, req: Withdrawal) -> None:
        self.process(req)
        if req.amount and self._next:
            self._next.handle(req)
        elif req.amount:
            raise ValueError(f"cannot dispense remaining {req.amount}")

    @abstractmethod
    def process(self, req: Withdrawal) -> None: ...

class Denomination(NoteHandler):
    def __init__(self, note: int, available: int) -> None:
        super().__init__()
        self.note, self.available = note, available

    def process(self, req: Withdrawal) -> None:
        count = min(req.amount // self.note, self.available)
        if count:
            req.dispensed[self.note] = count
            req.amount -= count * self.note
            self.available -= count

chain = Denomination(2000, 2)
chain.then(Denomination(500, 10)).then(Denomination(100, 50))

req = Withdrawal(5800, {})
chain.handle(req)
print(req.dispensed)   # {2000: 2, 500: 3, 100: 3}
```

Note the real ATM version must check feasibility *before* deducting counts, or roll back on failure; this sketch keeps it short.

## When to use / when not to

Use it for approval workflows, ATM dispensing, request middleware (auth, rate limit, validation), logging level filters, and support ticket escalation. Avoid it when the order is fixed and short and will never change; a few sequential calls are clearer. Also be wary when you need guaranteed handling, since a misconfigured chain can silently drop a request; always define what happens at the end.

## Common mistakes

- No terminal behaviour, so unhandled requests disappear silently.
- Handlers that depend on the order in undocumented ways.
- Mutating shared request state without rollback when a later handler fails.
- Very long chains that are hard to debug; log which handler acted.

## In the interview

**Q: Where would you use this in an ATM design?**
For dispensing notes: one handler per denomination, each takes as many notes as it can and passes the remainder down. Adding a Rs 200 note is a new link.

**Q: Chain of Responsibility vs Decorator?**
Both wrap or link handlers. A decorator always delegates and adds behaviour around the call; a chain handler may stop the request entirely or pass it on.

**Q: How do you make the chain configurable?**
Build it from a list in a factory or config, so ordering and membership change without code edits.

## Key takeaways

- A request flows through linked handlers; each handles, rejects, or forwards.
- Great for approvals, middleware, filters, and ATM dispensing.
- Always define what happens at the end of the chain.
- Build chains from configuration to keep them flexible.
