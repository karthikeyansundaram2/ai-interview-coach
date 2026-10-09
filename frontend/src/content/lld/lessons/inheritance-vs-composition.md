Inheritance says "this thing is a kind of that thing"; composition says "this thing has a part that does that job". Most flexible designs lean heavily on composition and use inheritance sparingly and deliberately.

## The idea

A smartphone is not a subclass of camera, a subclass of GPS, and a subclass of phone. It **contains** a camera module, a GPS chip, and a radio. If a better camera comes out, the manufacturer swaps the module. That is composition: build behaviour by assembling parts.

Inheritance is a strong, permanent bond. A subclass inherits every public method and every quirk of its parent, and changes to the parent ripple into every child. It is the right tool when there is a genuine, stable "is-a" relationship and the child truly honours the parent's contract.

## Why composition usually wins

- **Runtime flexibility.** You can swap a part at runtime; you cannot change a class's parent at runtime.
- **No combinatorial explosion.** Inheritance for features leads to `LoggingRetryingCachingClient`. Composition just stacks parts.
- **Looser coupling.** The container depends on the part's interface, not on its internals.
- **Avoids the fragile base class problem**, where a harmless-looking parent change breaks subclasses.

```python
from typing import Protocol

class Engine(Protocol):
    def start(self) -> str: ...

class PetrolEngine:
    def start(self) -> str:
        return "vroom"

class ElectricMotor:
    def start(self) -> str:
        return "hum"

class Car:
    def __init__(self, model: str, engine: Engine) -> None:
        self.model = model
        self._engine = engine  # composition: Car HAS-A Engine

    def start(self) -> str:
        return f"{self.model}: {self._engine.start()}"

    def swap_engine(self, engine: Engine) -> None:
        self._engine = engine

# Inheritance is still fine for a true, stable is-a with shared behaviour:
class Vehicle:
    def __init__(self, plate: str) -> None:
        self.plate = plate

    def describe(self) -> str:
        return f"{type(self).__name__}({self.plate})"

class Truck(Vehicle):
    def __init__(self, plate: str, axles: int) -> None:
        super().__init__(plate)
        self.axles = axles

car = Car("Nexon", PetrolEngine())
car.swap_engine(ElectricMotor())
print(car.start())               # Nexon: hum
print(Truck("TN-01", 3).describe())
```

## When to use / when not to

Use **inheritance** when the subtype is substitutable everywhere the parent is used (Liskov), the hierarchy is shallow (one or two levels), and you want shared behaviour, not just shared shape. Abstract base classes defining a contract are a healthy use.

Use **composition** when you are reusing behaviour, when behaviour varies independently along several axes, or when it must change at runtime. In LLD interviews this covers pricing, payment, notification, and matching strategies.

## Common mistakes

- Inheriting just to reuse a helper method ("Stack extends list").
- Deep hierarchies like `Vehicle -> Car -> ElectricCar -> SelfDrivingElectricCar`.
- Overriding a parent method to throw `NotImplementedError` because the child cannot support it; that is a Liskov violation and a sign the hierarchy is wrong.
- Modelling roles as subclasses (`Employee -> Manager`) when a person's role can change; roles should be composed.

## In the interview

**Q: Why prefer composition over inheritance?**
It keeps coupling low, lets behaviour change at runtime, and avoids class explosion when features combine. Inheritance locks in a relationship at compile time.

**Q: Give a case where inheritance is the right choice.**
A small family of types sharing a stable contract and real behaviour, such as `Piece` subclasses in chess, each implementing `valid_moves()`.

**Q: How would you model a user who can be both a driver and a rider?**
One `User` entity composed with `DriverProfile` and `RiderProfile`, not two subclasses, because a person can hold both roles at once.

## Key takeaways

- "Has-a" via composition is the default; "is-a" via inheritance is the exception.
- Inheritance is right for shallow, substitutable hierarchies with a stable contract.
- Model changeable roles and behaviours as composed parts.
- If a subclass needs to disable parent behaviour, the hierarchy is wrong.
