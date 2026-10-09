Design a library management system where members search the catalogue, borrow and return physical copies, place holds, and pay fines. It's mostly an entity-modelling exercise: the key insight is separating a *book* (the title) from its *copies* (the physical items).

## Requirements

**Functional**

- Librarians add books (title, authors, ISBN) and copies (barcode, rack location).
- Members search by title, author, or ISBN.
- Members borrow available copies; limits depend on membership tier (e.g. 3 basic, 6 premium); loan period 14 days.
- Members return copies; overdue returns incur a per-day fine with a cap.
- Members place a hold on a book when no copy is available; when a copy is returned, the next member in the hold queue is notified and the copy is reserved for them for 48 hours.
- Members with unpaid fines above a threshold cannot borrow.

**Non-functional**

- Correct under concurrent checkouts at multiple counters.
- Search should be fast for a catalogue of ~1M books (indexes, not scans).
- Notifications are asynchronous and shouldn't block returns.

## Core entities

| Entity | Responsibility |
| --- | --- |
| `Book` | Bibliographic record: ISBN, title, authors |
| `BookCopy` | Physical item: barcode, ISBN, status (AVAILABLE, LOANED, ON_HOLD, LOST) |
| `Member` | ID, tier, active loans count, outstanding fines |
| `Loan` | Copy, member, issue date, due date, return date |
| `Hold` | Member, ISBN, created time, status (WAITING, READY, EXPIRED, FULFILLED) |
| `FinePolicy` | Computes fine from overdue days |
| `Catalogue` | Search indexes by title words, author, ISBN |
| `LibraryService` | Borrow, return, place hold: orchestrates the above |

## Class design

```python
import threading
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import date, timedelta
from enum import Enum
from typing import Protocol

class CopyStatus(Enum):
    AVAILABLE = "available"
    LOANED = "loaned"
    ON_HOLD = "on_hold"
    LOST = "lost"

class Tier(Enum):
    BASIC = 3
    PREMIUM = 6          # value = max concurrent loans

@dataclass(frozen=True)
class Book:
    isbn: str
    title: str
    authors: tuple[str, ...]

@dataclass
class BookCopy:
    barcode: str
    isbn: str
    status: CopyStatus = CopyStatus.AVAILABLE
    reserved_for: str | None = None

@dataclass
class Member:
    member_id: str
    tier: Tier
    active_loans: int = 0
    fines_due: int = 0

@dataclass
class Loan:
    loan_id: str
    barcode: str
    member_id: str
    issued: date
    due: date
    returned: date | None = None

class FinePolicy(Protocol):
    def fine(self, due: date, returned: date) -> int: ...

class PerDayFine:
    def __init__(self, per_day: int = 10, cap: int = 500) -> None:
        self.per_day, self.cap = per_day, cap

    def fine(self, due: date, returned: date) -> int:
        return min(max((returned - due).days, 0) * self.per_day, self.cap)

class Catalogue:
    def __init__(self) -> None:
        self._by_isbn: dict[str, Book] = {}
        self._by_author: dict[str, set[str]] = defaultdict(set)
        self._by_word: dict[str, set[str]] = defaultdict(set)

    def add(self, book: Book) -> None: ...
    def search(self, query: str) -> list[Book]: ...

class Notifier(Protocol):
    def notify(self, member_id: str, message: str) -> None: ...

class LibraryService:
    LOAN_DAYS, HOLD_DAYS, FINE_BLOCK = 14, 2, 200

    def __init__(self, catalogue: Catalogue, fines: FinePolicy, notifier: Notifier) -> None:
        self.catalogue, self.fines, self.notifier = catalogue, fines, notifier
        self.copies: dict[str, BookCopy] = {}
        self.members: dict[str, Member] = {}
        self.loans: dict[str, Loan] = {}                 # active, by barcode
        self.holds: dict[str, deque[str]] = defaultdict(deque)   # isbn -> member ids
        self._lock = threading.Lock()

    def borrow(self, member_id: str, barcode: str, today: date) -> Loan: ...
    def return_copy(self, barcode: str, today: date) -> int: ...      # returns fine
    def place_hold(self, member_id: str, isbn: str) -> None: ...
    def expire_holds(self, today: date) -> None: ...
```

## Key flows

1. **Borrow**: under the lock, load member and copy. Reject if `fines_due > FINE_BLOCK`, if `active_loans >= tier.value`, or if the copy isn't `AVAILABLE` (or is `ON_HOLD` but reserved for someone else). Create `Loan(due = today + 14)`, set copy `LOANED`, increment `active_loans`.
2. **Return**: under the lock, close the loan, compute `fine = fines.fine(due, today)` and add to member's dues, decrement `active_loans`. If the hold queue for that ISBN is non-empty, pop the next member, set copy `ON_HOLD` with `reserved_for`, and notify asynchronously. Otherwise set `AVAILABLE`.
3. **Place hold**: allowed only if no copy of the ISBN is available; append member to the ISBN's queue (no duplicates).
4. **Expire holds** (daily job): any `ON_HOLD` copy whose reservation is older than 48 hours passes to the next member in the queue, or becomes `AVAILABLE`.
5. **Search**: tokenise the query and intersect index sets; ISBN lookups go straight to the map.

## Patterns used

- **Strategy**: `FinePolicy` (per-day, flat, tier-based waivers).
- **Observer / notifier**: hold-ready and due-date reminders go through a `Notifier` interface, dispatched asynchronously.
- **Facade**: `LibraryService` exposes the use cases and hides catalogue, copies, loans, and holds.
- **Repository (implied)**: the dicts stand in for repositories; in production each is behind an interface.
- **State (light)**: `CopyStatus` transitions are validated (`LOANED` can't go straight to `ON_HOLD` without a return).

## Concurrency & edge cases

- **Two counters scanning the same copy**: the status check and update must be atomic (lock, or conditional write `status = AVAILABLE` in the DB).
- **Borrow limit races**: two simultaneous borrows by one member could both pass the count check; keep the check and increment in the same critical section.
- **Hold fairness**: when a copy returns, it goes to the queue head, not to whoever is at the counter.
- **Lost copies**: mark `LOST`, charge replacement cost, close the loan.
- **Member deletes account with active loans**: block until returned or settled.

## Follow-ups the interviewer may ask

**Why separate Book and BookCopy?**
Bibliographic data is shared across copies; loans, holds-on-shelf, and status are per physical item. Merging them makes "3 copies of the same book" impossible to model cleanly.

**How would you send due-date reminders?**
A daily scheduled job queries loans due in two days and publishes reminder events to the notifier; it's idempotent per loan per day.

**How would you support multiple branches?**
Add `Branch` and give each copy a `branch_id`; holds can specify a pickup branch, and transfers become a copy status (`IN_TRANSIT`).

**How do you scale search?**
Move indexing to a search engine (Elasticsearch/OpenSearch) fed by catalogue change events; the `Catalogue` interface stays the same.

**How would you add e-books?**
A different copy type with a licence count instead of a physical status, behind a common `Lendable` interface for borrow and return.
