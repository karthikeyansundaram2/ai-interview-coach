The Liskov Substitution Principle says that if code works with a parent type, it must keep working when you hand it any subtype. A subclass that surprises its callers is a broken subclass, even if it compiles.

## The idea

If a hotel promises "any room on this floor has a bed and hot water", a guest assigned any room should get both. A "room" that is actually a storage closet technically fits the floor plan but breaks the promise. LSP is about **behavioural** compatibility, not just matching method names.

Formally, a subtype must not:

- **Strengthen preconditions** (demand more of the caller than the parent did).
- **Weaken postconditions** (promise less than the parent did).
- **Break invariants** the parent maintains.
- **Throw new kinds of exceptions** callers aren't prepared for.

## Why it matters

Polymorphism only works if substitution is safe. Every `isinstance` check you see in client code is often a scar from an LSP violation: someone had to special-case a subclass that misbehaved.

The textbook violation is `Square(Rectangle)`: setting width on a square silently changes height, so code that sets width then height gets the wrong area. A more realistic one:

```python
from abc import ABC, abstractmethod

class Bird(ABC):
    @abstractmethod
    def move(self) -> str: ...

class FlyingBird(Bird):
    def fly(self, altitude_m: int) -> str:
        return f"flying at {altitude_m}m"

    def move(self) -> str:
        return self.fly(100)

class Sparrow(FlyingBird):
    pass

class Penguin(Bird):  # NOT a FlyingBird, so it is never asked to fly
    def move(self) -> str:
        return "waddling"

def migrate(birds: list[Bird]) -> list[str]:
    return [b.move() for b in birds]  # safe for every Bird subtype

print(migrate([Sparrow(), Penguin()]))

# The violation we avoided:
# class Penguin(FlyingBird):
#     def fly(self, altitude_m: int) -> str:
#         raise NotImplementedError("penguins can't fly")   # breaks callers of fly()

class Account:
    def withdraw(self, amount: int) -> None:
        """Pre: amount > 0. Post: balance reduced by amount."""

class FixedDeposit(Account):
    def withdraw(self, amount: int) -> None:
        # Strengthened precondition (only after maturity) = LSP smell.
        # Better: don't make FixedDeposit a withdrawable Account at all.
        raise PermissionError("locked until maturity")
```

The fix is almost always to **reshape the hierarchy** so each type only promises what it can deliver, often by splitting interfaces (`Withdrawable`, `Flyable`).

## When to use / when not to

Check LSP every time you write a subclass: "Can every caller of the parent use this without knowing?" If the answer needs an asterisk, prefer composition or a separate interface. LSP is less of a concern with pure Protocols that have a single method, but behavioural contracts still apply.

## Common mistakes

- Overriding a method to raise `NotImplementedError` or do nothing.
- Subclasses that return `None` where the parent returns a value.
- Modelling with real-world taxonomy ("a square is a rectangle") instead of behavioural contracts.
- Adding `isinstance` checks in client code to work around a misbehaving subtype.

## In the interview

**Q: Give an example of an LSP violation.**
A `ReadOnlyList` subclass of a mutable list that raises on `append`. Callers of the parent expect `append` to work, so substitution breaks.

**Q: How do you fix it?**
Split the contract: a `ReadableList` interface and a `MutableList` interface extending it. The read-only type implements only the first.

**Q: How does LSP show up in LLD problems?**
In a vehicle or parking spot hierarchy: if `ElectricSpot` refuses non-electric vehicles while the base `Spot.fits(vehicle)` promised size-only checks, callers get surprised. Make the rule part of the contract (`can_park(vehicle)`) so every subtype answers it.

## Key takeaways

- Subtypes must honour the parent's behavioural contract, not just its signature.
- Don't strengthen preconditions or weaken postconditions.
- `NotImplementedError` in an override is a red flag.
- Fix violations by reshaping hierarchies or splitting interfaces.
