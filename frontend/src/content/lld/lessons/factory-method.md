Factory Method moves the decision of *which* concrete class to instantiate out of the calling code and into a dedicated method. Callers ask for "a notifier for this channel" and never mention `SmsNotifier` by name.

## The idea

At a coffee shop, you order "a cappuccino". You don't tell the barista which machine, which beans, or which milk jug to use. The barista (the factory) decides how to produce it. If the shop changes machines, your order stays the same.

There are two common shapes:

- **Classic GoF Factory Method**: a base class defines an abstract `create_x()` method that subclasses override, so each subclass decides what it creates.
- **Simple / parameterised factory**: a function or class that maps a key to a concrete type. This is what most LLD interviews actually use.

## Why it matters

Construction logic scattered across callers means every new type requires edits everywhere `if channel == ...` appears. A factory centralises that decision, keeps callers depending on the interface only (DIP), and gives one place to add new types (OCP).

```python
from abc import ABC, abstractmethod
from enum import Enum

class Channel(Enum):
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"

class Notifier(ABC):
    @abstractmethod
    def send(self, to: str, msg: str) -> None: ...

class EmailNotifier(Notifier):
    def send(self, to: str, msg: str) -> None:
        print(f"email -> {to}: {msg}")

class SmsNotifier(Notifier):
    def send(self, to: str, msg: str) -> None:
        print(f"sms -> {to}: {msg[:160]}")

class PushNotifier(Notifier):
    def send(self, to: str, msg: str) -> None:
        print(f"push -> {to}: {msg}")

class NotifierFactory:
    _registry: dict[Channel, type[Notifier]] = {
        Channel.EMAIL: EmailNotifier,
        Channel.SMS: SmsNotifier,
        Channel.PUSH: PushNotifier,
    }

    @classmethod
    def register(cls, channel: Channel, impl: type[Notifier]) -> None:
        cls._registry[channel] = impl

    @classmethod
    def create(cls, channel: Channel) -> Notifier:
        try:
            return cls._registry[channel]()
        except KeyError:
            raise ValueError(f"unsupported channel {channel}") from None

for ch in (Channel.EMAIL, Channel.SMS):
    NotifierFactory.create(ch).send("user-1", "Your ride is arriving")
```

The registry keeps the factory itself closed for modification: new channels register themselves rather than adding an `elif`.

## When to use / when not to

Use a factory when the concrete type depends on runtime input (a vehicle type from the gate scanner, a payment method from the request), when construction is non-trivial, or when you want callers decoupled from concrete classes. Don't add a factory for a class that's only ever constructed one way in one place; calling the constructor directly is clearer.

## Common mistakes

- A factory that's just a giant `if/elif` chain, recreating the problem in one place (acceptable for small, stable sets; a registry scales better).
- Returning concrete types from the factory's signature, so callers start depending on them.
- Mixing creation with business logic inside the factory.
- Confusing Factory Method with Abstract Factory (one product vs a family of related products).

## In the interview

**Q: Where would you use a factory in a parking lot?**
To create the right `Vehicle` or `Spot` subtype from input, and to choose the pricing strategy for a lot. Callers depend on the base types only.

**Q: Factory Method vs simple factory?**
Factory Method uses subclass overriding to vary the product; a simple factory is one function or class that maps inputs to types. Both hide concrete classes from callers.

**Q: How do you add a new type without modifying the factory?**
Use a registry: new implementations register under a key, so the factory code never changes.

## Key takeaways

- Factories centralise "which class do I instantiate?".
- Callers depend only on the product interface.
- Registries keep factories open for extension.
- Skip the factory when construction is trivial and fixed.
