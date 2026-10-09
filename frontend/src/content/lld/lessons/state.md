The State pattern models an object whose behaviour depends on its current status by giving each status its own class. Instead of every method starting with `if self.status == ...`, the current state object handles the call and decides the next state.

## The idea

A traffic light reacts to the "timer expired" signal differently depending on its colour: green goes to yellow, yellow goes to red, red goes to green. Rather than one big rulebook, imagine each colour as a little card that knows only "what I do when the timer expires". The light just holds the current card.

```text
   ┌────────┐ insert_coin ┌─────────┐ select ┌───────────┐
   │  Idle  │────────────>│ HasCoin │───────>│ Dispensing│
   └────────┘<────────────└─────────┘        └─────┬─────┘
        ▲        refund                            │ done
        └──────────────────────────────────────────┘
```

## Why it matters

State machines are everywhere in LLD: vending machines, ATMs, elevators, orders, rides, bookings. With plain conditionals, every method checks every status, and adding a status means editing every method. With the State pattern, each state class contains only its legal transitions, and illegal actions are rejected in one obvious place.

```python
from __future__ import annotations
from abc import ABC

class VendingState(ABC):
    def insert_coin(self, m: VendingMachine, amount: int) -> None:
        raise RuntimeError(f"cannot insert coin while {type(self).__name__}")

    def select(self, m: VendingMachine, slot: str) -> None:
        raise RuntimeError(f"cannot select while {type(self).__name__}")

class Idle(VendingState):
    def insert_coin(self, m: VendingMachine, amount: int) -> None:
        m.balance += amount
        m.state = HasMoney()

class HasMoney(VendingState):
    def insert_coin(self, m: VendingMachine, amount: int) -> None:
        m.balance += amount

    def select(self, m: VendingMachine, slot: str) -> None:
        price = m.prices[slot]
        if m.balance < price:
            raise RuntimeError(f"need {price - m.balance} more")
        m.balance -= price
        print(f"dispensing {slot}, change {m.balance}")
        m.balance = 0
        m.state = Idle()

class VendingMachine:
    def __init__(self, prices: dict[str, int]) -> None:
        self.prices = prices
        self.balance = 0
        self.state: VendingState = Idle()

    def insert_coin(self, amount: int) -> None:
        self.state.insert_coin(self, amount)

    def select(self, slot: str) -> None:
        self.state.select(self, slot)

vm = VendingMachine({"A1": 25})
vm.insert_coin(10)
vm.insert_coin(20)
vm.select("A1")          # dispensing A1, change 5
```

The base class rejects every action by default; each state overrides only what it allows. Adding an `OutOfStock` state is one new class.

## When to use / when not to

Use it when an object has several distinct modes, behaviour differs substantially per mode, and transitions have rules. For simple lifecycles (three statuses, a couple of checks), a transition table such as `ALLOWED = {PLACED: {CONFIRMED, CANCELLED}, ...}` plus an enum is lighter and often clearer. Many interview answers combine both: an enum for persistence and a table to validate transitions.

## Common mistakes

- Spreading transition logic across both the context and the states.
- Creating state classes that hold per-instance data that should live in the context.
- Forgetting to reject illegal transitions explicitly (silently ignoring them hides bugs).
- Using the full pattern for a trivial two-state toggle.
- Not making transitions atomic when multiple threads act on the same object.

## In the interview

**Q: State vs Strategy?**
Both delegate to an interchangeable object. Strategy is chosen externally and stays put; State objects trigger transitions themselves as the context moves through its lifecycle.

**Q: How do you persist an object using the State pattern?**
Store an enum of the current state and rebuild the state object on load via a small mapping from enum to state class.

**Q: Where would you use it?**
Vending machine (idle, has money, dispensing, out of stock), ATM (no card, card inserted, authenticated), elevator (idle, moving up, moving down, maintenance), and order or ride lifecycles.

## Key takeaways

- One class per state; the context delegates to its current state.
- Illegal actions fail in one obvious place.
- Transition tables are a lighter alternative for simple lifecycles.
- Persist state as an enum, rebuild the object on load.
