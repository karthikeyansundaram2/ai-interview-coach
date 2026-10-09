Design the software for an ATM: card insertion, PIN authentication, balance enquiry, cash withdrawal with note dispensing, and deposits. It combines a State machine for the session with Chain of Responsibility for dispensing notes, plus careful thinking about failures between the ATM and the bank.

## Requirements

**Functional**

- Insert card, enter PIN (3 attempts, then retain the card / block).
- Operations: balance enquiry, withdraw cash, deposit cash, change PIN, mini statement.
- Withdrawal: amount must be a multiple of Rs 100 and within daily limits; the ATM must be able to dispense it with available notes.
- Dispense using Rs 2000, 500, 200, 100 notes, minimising note count.
- Print or display receipts; eject card at session end.

**Non-functional**

- Money must never be lost or double-debited, even if the ATM crashes mid-transaction.
- The bank is a remote system; network calls can time out.
- Session timeouts for inactivity.
- Hardware components (card reader, keypad, dispenser, printer) are behind interfaces.

## Core entities

| Entity | Responsibility |
| --- | --- |
| `Card` | Card number, bank, expiry |
| `Session` | Card, auth status, attempts, account ID, start time |
| `ATMState` (interface) | Idle, CardInserted, Authenticated, Transacting, OutOfService |
| `Transaction` | ID, type, amount, status (PENDING, COMMITTED, REVERSED) |
| `CashDispenser` | Note inventory; chain of denomination handlers |
| `BankClient` (interface) | Authenticate, debit with idempotency key, credit, reverse |
| `Hardware` interfaces | `CardReader`, `Keypad`, `Screen`, `Printer` |
| `ATM` | Context: current state, session, dispenser, bank client |

## Class design

```python
from __future__ import annotations
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Protocol

@dataclass(frozen=True)
class Card:
    number: str
    bank_code: str

class TxnStatus(Enum):
    PENDING = "pending"
    COMMITTED = "committed"
    REVERSED = "reversed"

@dataclass
class Transaction:
    kind: str
    amount: int
    txn_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    status: TxnStatus = TxnStatus.PENDING

class BankClient(Protocol):
    def verify_pin(self, card: Card, pin: str) -> str | None: ...        # account id
    def debit(self, account_id: str, amount: int, txn_id: str) -> bool: ...  # idempotent
    def reverse(self, txn_id: str) -> None: ...
    def balance(self, account_id: str) -> int: ...

class NoteHandler:
    """Chain of Responsibility: each handler dispenses one denomination."""

    def __init__(self, note: int, count: int, nxt: NoteHandler | None = None) -> None:
        self.note, self.count, self.next = note, count, nxt

    def plan(self, amount: int) -> dict[int, int] | None:
        """Pure: returns a dispense plan without mutating counts."""
        for use in range(min(amount // self.note, self.count), -1, -1):
            rest = amount - use * self.note
            if rest == 0:
                return {self.note: use} if use else {}
            if self.next and (sub := self.next.plan(rest)) is not None:
                return ({self.note: use} if use else {}) | sub
        return None

class CashDispenser:
    def __init__(self, chain: NoteHandler) -> None:
        self._chain = chain

    def can_dispense(self, amount: int) -> dict[int, int] | None:
        return self._chain.plan(amount)

    def dispense(self, plan: dict[int, int]) -> None: ...   # decrement counts, drive hardware

class ATMState(ABC):
    def insert_card(self, atm: ATM, card: Card) -> None:
        raise RuntimeError("not allowed now")

    def enter_pin(self, atm: ATM, pin: str) -> None:
        raise RuntimeError("not allowed now")

    def withdraw(self, atm: ATM, amount: int) -> None:
        raise RuntimeError("not allowed now")

    def eject(self, atm: ATM) -> None:
        atm.reset()

class IdleState(ATMState): ...
class CardInsertedState(ATMState): ...        # enter_pin with attempt counting
class AuthenticatedState(ATMState): ...       # balance / withdraw / deposit
class OutOfServiceState(ATMState): ...

@dataclass
class Session:
    card: Card
    account_id: str | None = None
    pin_attempts: int = 0

class ATM:
    MAX_PIN_ATTEMPTS = 3

    def __init__(self, bank: BankClient, dispenser: CashDispenser) -> None:
        self.bank, self.dispenser = bank, dispenser
        self.state: ATMState = IdleState()
        self.session: Session | None = None
        self.journal: list[Transaction] = []        # persisted locally

    def reset(self) -> None:
        self.session, self.state = None, IdleState()
```

## Key flows

1. **Insert card** (Idle -> CardInserted): read card, create `Session`.
2. **Enter PIN**: `bank.verify_pin`; on success store `account_id`, go to Authenticated. On failure increment attempts; at 3, retain the card, notify the bank, reset.
3. **Withdraw** (Authenticated):
   1. Validate the amount (multiple of 100, within the per-transaction limit).
   2. `plan = dispenser.can_dispense(amount)`; if `None`, show "choose a different amount" *before* touching the bank.
   3. Create `Transaction` and write it to the local journal as PENDING.
   4. `bank.debit(account_id, amount, txn_id)` (idempotent on `txn_id`); on decline, mark failed and return.
   5. Dispense physically; on success mark COMMITTED. If the dispenser faults, call `bank.reverse(txn_id)` and mark REVERSED.
   6. Print receipt; ask whether to continue or eject.
4. **Timeout**: an inactivity timer ejects the card and resets.
5. **Recovery on reboot**: scan the journal for PENDING transactions and reconcile with the bank (reverse if cash wasn't dispensed).

## Patterns used

- **State**: ATM session modes, each permitting only legal actions.
- **Chain of Responsibility**: denomination handlers compute and dispense the note plan; adding Rs 200 notes is one more link.
- **Adapter**: hardware drivers and the bank network protocol (ISO 8583) behind `BankClient` and hardware interfaces.
- **Command (light)**: journaled `Transaction` objects allow reconciliation and reversal.
- **Facade**: `ATM` exposes simple operations to the UI layer.

## Concurrency & edge cases

- One user per ATM, but the **account** can be accessed concurrently from other channels, so the bank enforces balance atomically; the ATM never computes balances itself.
- **Network timeout after debit**: the ATM doesn't know whether the debit happened. Retrying with the same `txn_id` is safe because the bank's debit is idempotent; if it can't confirm, don't dispense and trigger reversal.
- **Dispense check before debit**: avoids debiting for amounts the machine can't pay out.
- **Partial dispense / jam**: sensors report notes actually dispensed; reverse the difference.
- **Card left in the machine**: retain after a timeout.

## Follow-ups the interviewer may ask

**Why plan dispensing before debiting?**
So the customer is never charged for an amount the machine can't pay. The plan is a pure computation; counts change only after the debit succeeds.

**Why is greedy note selection sometimes wrong?**
With limited notes, greedy can fail (e.g. Rs 600 with no Rs 100s and three Rs 200s but one Rs 500 tried first). The backtracking plan above handles it; denominations are few, so it's fast.

**How do you guarantee no double debit?**
Idempotency key (`txn_id`) on every bank call plus a local journal for reconciliation after crashes.

**How would you add cardless (UPI) withdrawals?**
A new authentication state that verifies a one-time code via the bank; the withdraw flow after authentication is unchanged.
