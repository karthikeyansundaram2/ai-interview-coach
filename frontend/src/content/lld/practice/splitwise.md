Design an expense-sharing app like Splitwise where friends record shared expenses, split them in different ways, and see who owes whom. The interesting parts are modelling split types cleanly, keeping balances consistent, and simplifying debts.

## Requirements

**Functional**

- Users and groups; expenses can be inside a group or between individuals.
- An expense has a payer (or several payers), an amount, participants, and a split type: EQUAL, EXACT amounts, PERCENTAGE, or SHARES.
- Show balances: per user ("you owe Rs 450 overall"), per pair, and per group.
- Record settlements (A pays B).
- Simplify debts within a group to minimise the number of transactions.
- Edit or delete an expense and have balances update correctly.

**Non-functional**

- Money in integer paise, never floats; rounding remainders must be assigned deterministically.
- Balances always consistent with the expense history (sum of all balances is zero).
- Concurrent expense additions to the same group must not corrupt balances.

## Core entities

| Entity | Responsibility |
| --- | --- |
| `User` | ID, name, contact |
| `Group` | Members, expenses |
| `Expense` | ID, payer(s), total, splits, description, created by |
| `Split` | User and amount owed for one expense |
| `SplitStrategy` (interface) | Turns inputs into a list of `Split`s, validating them |
| `BalanceSheet` | Net balance per pair (who owes whom) |
| `Settlement` | A payment from one user to another |
| `DebtSimplifier` | Computes the minimal set of transfers |
| `ExpenseService` | Facade: add/edit expense, settle, query balances |

## Class design

```python
import threading
from abc import ABC, abstractmethod
from collections import defaultdict
from dataclasses import dataclass
from enum import Enum

class SplitType(Enum):
    EQUAL = "equal"
    EXACT = "exact"
    PERCENT = "percent"
    SHARES = "shares"

@dataclass(frozen=True)
class Split:
    user_id: str
    amount: int            # paise

@dataclass(frozen=True)
class Expense:
    expense_id: str
    group_id: str | None
    paid_by: str
    total: int
    splits: tuple[Split, ...]
    description: str

class SplitStrategy(ABC):
    @abstractmethod
    def split(self, total: int, users: list[str], values: list[float] | None) -> list[Split]: ...

class EqualSplit(SplitStrategy):
    def split(self, total: int, users: list[str], values: list[float] | None) -> list[Split]:
        base, rem = divmod(total, len(users))
        # first `rem` users absorb one extra paisa each, deterministically
        return [Split(u, base + (1 if i < rem else 0)) for i, u in enumerate(users)]

class ExactSplit(SplitStrategy):
    def split(self, total: int, users: list[str], values: list[float] | None) -> list[Split]:
        assert values is not None
        if sum(int(v) for v in values) != total:
            raise ValueError("exact amounts must add up to total")
        return [Split(u, int(v)) for u, v in zip(users, values)]

class PercentSplit(SplitStrategy): ...     # validate sum == 100, distribute rounding remainder
class ShareSplit(SplitStrategy): ...       # weights, e.g. 2:1:1

SPLITTERS: dict[SplitType, SplitStrategy] = {
    SplitType.EQUAL: EqualSplit(), SplitType.EXACT: ExactSplit(),
    SplitType.PERCENT: PercentSplit(), SplitType.SHARES: ShareSplit(),
}

class BalanceSheet:
    """balances[a][b] > 0 means b owes a that much."""

    def __init__(self) -> None:
        self._bal: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    def apply(self, creditor: str, debtor: str, amount: int) -> None:
        if creditor == debtor:
            return
        self._bal[creditor][debtor] += amount
        self._bal[debtor][creditor] -= amount

    def net(self, user_id: str) -> int:
        return sum(self._bal[user_id].values())

    def between(self, a: str, b: str) -> int:
        return self._bal[a][b]

class DebtSimplifier:
    def simplify(self, nets: dict[str, int]) -> list[tuple[str, str, int]]: ...  # (from, to, amt)

class ExpenseService:
    def __init__(self) -> None:
        self.expenses: dict[str, Expense] = {}
        self.sheets: dict[str | None, BalanceSheet] = defaultdict(BalanceSheet)
        self._locks: dict[str | None, threading.Lock] = defaultdict(threading.Lock)

    def add_expense(self, group_id: str | None, paid_by: str, total: int,
                    users: list[str], kind: SplitType,
                    values: list[float] | None = None, description: str = "") -> Expense: ...
    def delete_expense(self, expense_id: str) -> None: ...     # apply the inverse
    def settle(self, group_id: str | None, payer: str, payee: str, amount: int) -> None: ...
    def simplified_debts(self, group_id: str) -> list[tuple[str, str, int]]: ...
```

## Key flows

1. **Add expense**:
   1. Validate the payer and participants are group members, `total > 0`.
   2. `splits = SPLITTERS[kind].split(total, users, values)`; the strategy validates (sums, percentages).
   3. Under the group's lock: store the `Expense`; for each split where `user != paid_by`, `sheet.apply(paid_by, user, split.amount)`.
   4. Notify participants (async).
2. **Delete/edit expense**: apply the inverse of the old splits, then (for edit) apply the new ones, in the same critical section. Keep an audit trail rather than hard-deleting.
3. **Settle up**: when the payer hands money to the payee, call `sheet.apply(creditor=payer, debtor=payee, amount)`, which cancels out the payer's existing debt; record a `Settlement` for the history.
4. **Simplify debts**:
   1. Compute each member's net balance (positive = owed money, negative = owes).
   2. Put creditors and debtors in two max-heaps by absolute amount.
   3. Repeatedly match the largest debtor with the largest creditor, transfer `min(|d|, c)`, push back any remainder.
   4. Produces at most N-1 transfers.

## Patterns used

- **Strategy**: `SplitStrategy` for EQUAL, EXACT, PERCENT, SHARES; adding "split by item" is a new class.
- **Factory/registry**: `SPLITTERS` maps split types to strategies.
- **Observer**: notifications and activity feed subscribe to `ExpenseAdded` / `SettlementRecorded` events.
- **Facade**: `ExpenseService` exposes the use cases.
- **Command / event sourcing (optional)**: expenses and settlements are an append-only log; balances are a projection that can be rebuilt.

## Concurrency & edge cases

- Two members adding expenses simultaneously to the same group: per-group lock (or a DB transaction updating balance rows), so pairwise updates are atomic.
- **Rounding**: Rs 100 split three ways is 3334 + 3333 + 3333 paise; assign remainders deterministically (or to the payer).
- **Payer not among participants** (paid for others only) and **payer among participants** (their own share isn't a debt).
- **Multiple payers**: model as several payer contributions, effectively several expenses netted together.
- **Currency**: store currency per expense; balances are per currency unless you convert at a recorded rate.
- **Removing a member with a non-zero balance**: block until settled.

## Follow-ups the interviewer may ask

**Is the greedy debt simplification optimal?**
It guarantees at most N-1 transactions, which is usually good enough. Finding the true minimum is NP-hard (it relates to partitioning into zero-sum subsets), so the greedy heuristic is the standard practical answer.

**Why store pairwise balances instead of recomputing from expenses?**
Reads (balance screens) are far more frequent than writes. Pairwise balances give O(1) lookups; the expense log remains the source of truth for audits and rebuilds.

**How would you scale this?**
Partition by group; each group's expenses and balances live together, so all writes for a group are local and can be serialised per group.

**How do you add recurring expenses?**
A `RecurringExpense` template plus a scheduler that creates normal expenses on schedule, idempotent per period.
