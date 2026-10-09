Design a vending machine that accepts coins and notes, lets users select a product, dispenses it with change, and supports refunds. It's the textbook State-pattern problem, with a tricky sub-problem hiding inside: making change with limited coins.

## Requirements

**Functional**

- Products sit in slots (e.g. A1) with price and quantity.
- Accepts denominations: Rs 1, 2, 5, 10 coins and Rs 20, 50, 100 notes.
- User inserts money, selects a slot, receives product and change.
- User can cancel at any time and get a full refund.
- Reject selection if the product is sold out or funds are insufficient.
- If exact change can't be made, refuse the sale and refund.
- Operator mode: restock products, collect cash, refill change.

**Non-functional**

- Never lose money: the inserted balance must always be either refunded or converted to a sale plus change.
- One user at a time (single physical interface), but operator and hardware events must not corrupt state.
- Easy to add new states (maintenance) and payment types (card, UPI).

## Core entities

| Entity | Responsibility |
| --- | --- |
| `Denomination` (enum) | Accepted coins/notes with values |
| `Product`, `Slot` | Name, price; slot code and quantity |
| `Inventory` | Slot lookup, decrement, restock |
| `CashBox` | Counts per denomination; computes change |
| `VendingState` (interface) | `insert`, `select`, `cancel`, `dispense` behaviour per state |
| `IdleState`, `HasMoneyState`, `DispensingState`, `MaintenanceState` | Concrete states |
| `VendingMachine` | Context: holds current state, balance, inventory, cash box |

## Class design

```python
from __future__ import annotations
from abc import ABC
from dataclasses import dataclass
from enum import Enum

class Denomination(Enum):
    ONE, TWO, FIVE, TEN, TWENTY, FIFTY, HUNDRED = 1, 2, 5, 10, 20, 50, 100

@dataclass
class Slot:
    code: str
    name: str
    price: int
    qty: int

class Inventory:
    def __init__(self, slots: list[Slot]) -> None:
        self._slots = {s.code: s for s in slots}

    def get(self, code: str) -> Slot: ...
    def take_one(self, code: str) -> None: ...
    def restock(self, code: str, qty: int) -> None: ...

class CashBox:
    def __init__(self, counts: dict[Denomination, int]) -> None:
        self._counts = dict(counts)

    def add(self, coins: list[Denomination]) -> None: ...

    def make_change(self, amount: int) -> list[Denomination] | None:
        """Greedy largest-first with availability; returns None if impossible.
        (Greedy is optimal for canonical coin systems like INR; use DP otherwise.)"""
        ...

    def remove(self, coins: list[Denomination]) -> None: ...

class InvalidAction(Exception): ...

class VendingState(ABC):
    def insert(self, m: VendingMachine, d: Denomination) -> None:
        raise InvalidAction(f"insert not allowed in {type(self).__name__}")

    def select(self, m: VendingMachine, code: str) -> None:
        raise InvalidAction(f"select not allowed in {type(self).__name__}")

    def cancel(self, m: VendingMachine) -> list[Denomination]:
        return []

class IdleState(VendingState):
    def insert(self, m: VendingMachine, d: Denomination) -> None:
        m.inserted.append(d)
        m.state = HasMoneyState()

class HasMoneyState(VendingState):
    def insert(self, m: VendingMachine, d: Denomination) -> None:
        m.inserted.append(d)

    def select(self, m: VendingMachine, code: str) -> None: ...   # validate, change, dispense

    def cancel(self, m: VendingMachine) -> list[Denomination]:
        refund, m.inserted = m.inserted, []
        m.state = IdleState()
        return refund

class DispensingState(VendingState): ...     # rejects everything until hardware confirms
class MaintenanceState(VendingState): ...    # operator only

class VendingMachine:
    def __init__(self, inventory: Inventory, cash: CashBox) -> None:
        self.inventory, self.cash = inventory, cash
        self.inserted: list[Denomination] = []
        self.state: VendingState = IdleState()

    @property
    def balance(self) -> int:
        return sum(d.value for d in self.inserted)

    def insert(self, d: Denomination) -> None:
        self.state.insert(self, d)

    def select(self, code: str) -> None:
        self.state.select(self, code)

    def cancel(self) -> list[Denomination]:
        return self.state.cancel(self)
```

## Key flows

1. **Insert money** (Idle -> HasMoney): validate denomination, append to `inserted`. More inserts stay in HasMoney.
2. **Select product** (HasMoney):
   1. Look up slot; if `qty == 0`, raise `SoldOut` (stay in HasMoney so user can choose another or cancel).
   2. If `balance < price`, raise `InsufficientFunds` with the shortfall.
   3. Add inserted coins to the cash box (they're now usable for change), then `change = cash.make_change(balance - price)`.
   4. If change is `None`, remove the inserted coins again and refund: "exact change only".
   5. Otherwise remove change from cash box, decrement inventory, move to Dispensing, trigger hardware, return product and change, clear `inserted`, go to Idle.
3. **Cancel** (HasMoney -> Idle): return exactly the coins inserted.
4. **Maintenance**: operator key switches to Maintenance (only from Idle); restock and collect cash; switch back to Idle.

## Patterns used

- **State**: each machine mode is a class that only implements the actions valid in that mode. Illegal actions fail in one place (the base class).
- **Strategy**: change-making algorithm (greedy vs DP) and pricing (e.g. happy-hour discounts) can be swapped.
- **Factory (optional)**: payment acceptors for coin, note, card, and UPI behind a `PaymentAcceptor` interface.
- **Facade**: `VendingMachine` is the only API the hardware panel uses.

## Concurrency & edge cases

- Only one customer interacts at a time, but hardware callbacks (coin sensor, dispense-complete) arrive on other threads: guard state transitions with a lock on the machine.
- **Dispense failure** (product stuck): refund the full amount and mark the slot faulty.
- **Power loss mid-transaction**: persist `inserted` and state to non-volatile storage, and resume or refund on boot.
- **Change-making**: greedy can fail when large coins run out even though a combination exists (e.g. need 6 with only 5s and 2s left: 2+2+2 works, greedy 5 fails). Use a bounded DP when coin counts are limited.
- **Counterfeit or jammed coins**: reject at the acceptor before they reach state logic.

## Follow-ups the interviewer may ask

**Why the State pattern instead of an enum and if/else?**
Each operation's behaviour differs per state; with State, adding Maintenance or OutOfService is one class, and illegal actions are rejected by default rather than forgotten in some branch.

**How would you support card or UPI payments?**
Add a `PaymentAcceptor` interface. A card payment authorises the exact price at selection time, so no change is needed; states stay the same, with HasMoney generalised to HasCredit.

**How do you guarantee correct change?**
Check change feasibility *before* committing the sale, with the inserted coins included in the pool, and use DP for limited coin counts.

**How would you track sales remotely?**
Publish `SaleCompleted` and `LowStock` events to an observer that batches them to a backend when connectivity is available.
