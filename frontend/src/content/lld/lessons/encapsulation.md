Encapsulation means an object owns its data and is the only one allowed to change it in ways that matter. Get this right and most bugs about "who set this to a negative number?" simply cannot happen.

## The idea

Think of a bank teller. You never walk into the vault and adjust your balance yourself; you ask the teller to deposit or withdraw, and the teller checks the rules first. The vault is the state, the teller is the public method, and the rules are the object's **invariants**: facts that must always be true, like "balance is never negative".

Encapsulation is not about making fields private for its own sake. It is about putting the rules next to the data so that every change goes through one gate that enforces them.

## Why it matters

- **Invariants live in one place.** If ten callers can set `balance` directly, ten callers must remember the rules. One method means one place to get it right.
- **Freedom to change internals.** You can switch from a float to `Decimal`, or add an audit log, without touching callers.
- **Easier concurrency.** When all mutations go through a few methods, those are the only places you need to lock.

Python has no truly private fields. A leading underscore is a convention meaning "internal, do not touch", and `@property` lets you expose read access without write access.

```python
from dataclasses import dataclass, field
from decimal import Decimal

class InsufficientFunds(Exception):
    pass

@dataclass
class Account:
    owner: str
    _balance: Decimal = field(default=Decimal("0"))
    _history: list[tuple[str, Decimal]] = field(default_factory=list)

    @property
    def balance(self) -> Decimal:
        return self._balance

    def deposit(self, amount: Decimal) -> None:
        if amount <= 0:
            raise ValueError("deposit must be positive")
        self._balance += amount
        self._history.append(("deposit", amount))

    def withdraw(self, amount: Decimal) -> None:
        if amount <= 0:
            raise ValueError("withdrawal must be positive")
        if amount > self._balance:
            raise InsufficientFunds(f"{self.owner} has {self._balance}")
        self._balance -= amount
        self._history.append(("withdraw", amount))

    def statement(self) -> tuple[tuple[str, Decimal], ...]:
        return tuple(self._history)  # copy, so callers cannot mutate history

acct = Account("karthi")
acct.deposit(Decimal("100"))
acct.withdraw(Decimal("30"))
print(acct.balance)  # 70
```

Notice `statement()` returns a tuple, not the internal list. Returning a mutable internal collection is the most common way encapsulation leaks.

## When to use / when not to

Use it for any object with rules: accounts, orders, inventories, game boards, anything with a lifecycle. Do not bother with getters and setters on plain data carriers like DTOs or config records; a frozen dataclass with public fields is clearer there. Writing `get_x()` / `set_x()` pairs that do nothing is ceremony, not encapsulation.

## Common mistakes

- Exposing a setter for every field, which moves the rules back out to callers.
- Returning internal lists or dicts, letting callers mutate state behind your back.
- Validating in the caller ("check balance, then call withdraw") instead of inside the method, which also creates a race condition.
- Treating encapsulation as "everything private" instead of "invariants protected".

## In the interview

**Q: Python has no private keyword. How do you encapsulate?**
By convention (`_field`), read-only `@property` accessors, and by exposing intention-revealing methods (`withdraw`) rather than raw setters. Encapsulation is a design discipline, not a language feature.

**Q: Why not just validate in the service layer?**
Because then every new caller must remember to validate. Putting the check in the entity makes invalid states unrepresentable no matter who calls it.

**Q: How does encapsulation help with thread safety?**
All mutation goes through a few methods, so you can guard exactly those with a lock and reason about correctness locally.

## Key takeaways

- Encapsulation means protecting invariants, not hiding fields for fun.
- Expose behaviour (`withdraw`) instead of setters (`set_balance`).
- Never hand out mutable references to internal collections.
- Fewer mutation paths make both correctness and locking easier.
