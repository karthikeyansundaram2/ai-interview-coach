Polymorphism lets you write code against one interface and have many different objects respond in their own way. It is the quiet engine behind Strategy, State, Command, and almost every other pattern you will use in an interview.

## The idea

A universal remote has one "power" button. Press it at the TV and the TV turns on; press it at the AC and the AC turns on. The remote does not contain an `if device == "tv"` branch; each device knows how to handle the same signal. That is polymorphism: the **same message**, **different behaviour**, chosen by the receiver.

In Python, polymorphism comes in two flavours:

- **Subtype polymorphism**: classes share a base class or ABC and override methods.
- **Duck typing / structural polymorphism**: any object with the right methods works, optionally checked with `typing.Protocol`.

## Why it matters

The alternative to polymorphism is a type switch:

```text
if shape.kind == "circle": ...
elif shape.kind == "square": ...
elif shape.kind == "triangle": ...
```

Every new type means editing every switch scattered across the codebase. Polymorphism moves each branch into the type that owns it, so adding a type means adding a class, not hunting for `if` statements. That is the Open/Closed principle in practice.

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass

class Notifier(ABC):
    @abstractmethod
    def send(self, to: str, message: str) -> bool: ...

@dataclass
class EmailNotifier(Notifier):
    smtp_host: str

    def send(self, to: str, message: str) -> bool:
        print(f"[email via {self.smtp_host}] {to}: {message}")
        return True

@dataclass
class SmsNotifier(Notifier):
    sender_id: str

    def send(self, to: str, message: str) -> bool:
        print(f"[sms {self.sender_id}] {to}: {message[:160]}")
        return True

class PushNotifier(Notifier):
    def send(self, to: str, message: str) -> bool:
        print(f"[push] {to}: {message}")
        return True

def broadcast(notifiers: list[Notifier], to: str, message: str) -> int:
    # No type checks: each notifier decides how to send.
    return sum(n.send(to, message) for n in notifiers)

sent = broadcast(
    [EmailNotifier("smtp.local"), SmsNotifier("KAIVON"), PushNotifier()],
    to="user-42",
    message="Your order is out for delivery",
)
print(sent)  # 3
```

## When to use / when not to

Reach for polymorphism whenever behaviour varies by "kind": payment methods, pieces in a game, vehicle types with different pricing, notification channels. Avoid it when the variation is purely data (two discount levels that differ only by a percentage are a field, not two classes). A dictionary mapping keys to functions is also a perfectly Pythonic, lightweight form of polymorphism for small cases.

## Common mistakes

- Creating a base class but still writing `isinstance` checks in callers, which defeats the point.
- Subclasses that change the meaning of a method (returning `None` where the parent returns a value), breaking substitutability.
- Using inheritance-based polymorphism where one class with a field would do.
- Forgetting that overloading by argument types is not native in Python; use separate method names or `functools.singledispatch`.

## In the interview

**Q: How does polymorphism relate to the Open/Closed principle?**
It is the main mechanism for it. New behaviour arrives as a new class implementing an existing interface, so existing callers stay untouched.

**Q: Duck typing or ABCs in Python?**
Duck typing is idiomatic, but for interview designs an ABC or `Protocol` documents the contract and lets type checkers catch mistakes. I use `Protocol` for structural contracts and ABCs when I want shared base behaviour.

**Q: Where does polymorphism show up in a parking lot design?**
Pricing strategies, spot types, and payment methods. The lot calls `strategy.fee(ticket)` without knowing which strategy it holds.

## Key takeaways

- Same message, different behaviour, decided by the receiver.
- Replace type switches with classes that own their branch.
- Python supports both nominal (ABC) and structural (Protocol) polymorphism.
- Don't create subclasses for differences that are just data.
