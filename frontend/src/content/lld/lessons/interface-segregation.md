The Interface Segregation Principle says no class should be forced to depend on methods it does not use. Prefer several small, role-focused interfaces over one large "do everything" interface.

## The idea

A Swiss Army knife is great on a hike, but you wouldn't make every kitchen worker carry one when they only need a peeler. Fat interfaces are the Swiss Army knife: every implementer must provide every tool, and every client is coupled to tools it never touches.

ISP has two sides:

- **Implementers** shouldn't be forced to stub out methods they can't support.
- **Clients** should depend only on the slice of behaviour they actually call.

## Why it matters

Fat interfaces cause LSP violations (stubs that raise), unnecessary coupling (changes to an unused method still affect you), and bloated test fakes. Small interfaces compose cleanly: a class can implement several, and each client asks for exactly the role it needs.

```python
from typing import Protocol

# Fat interface (avoid):
# class Machine(Protocol):
#     def print_doc(self, doc: str) -> None: ...
#     def scan(self) -> bytes: ...
#     def fax(self, number: str, doc: str) -> None: ...

class Printer(Protocol):
    def print_doc(self, doc: str) -> None: ...

class Scanner(Protocol):
    def scan(self) -> bytes: ...

class BasicPrinter:
    def print_doc(self, doc: str) -> None:
        print(f"printing {doc!r}")

class OfficeMultiFunction:
    def print_doc(self, doc: str) -> None:
        print(f"MFP printing {doc!r}")

    def scan(self) -> bytes:
        return b"%PDF-scan"

def print_invoice(printer: Printer, invoice_id: str) -> None:
    printer.print_doc(f"Invoice {invoice_id}")

def archive_paper(scanner: Scanner) -> int:
    return len(scanner.scan())

print_invoice(BasicPrinter(), "INV-7")        # only needs Printer
print_invoice(OfficeMultiFunction(), "INV-8")  # MFP satisfies both roles
print(archive_paper(OfficeMultiFunction()))
```

`BasicPrinter` never has to pretend to scan, and `print_invoice` cannot accidentally depend on scanning.

## When to use / when not to

Split an interface when different clients use disjoint subsets of it, or when some implementers can't support every method. A common LLD example is a repository: a reporting job needs only `find`, while the booking flow needs `find` and `save`. Don't fragment interfaces that are always used together; a `Stack` with `push` and `pop` split into `Pusher` and `Popper` is silly.

## Common mistakes

- A single `IUserService` with 25 methods that every controller depends on.
- Implementers raising `NotImplementedError` for half the interface.
- Splitting interfaces by implementation detail rather than by client role.
- Over-segregating into single-method interfaces that are always needed together.

## In the interview

**Q: How is ISP different from SRP?**
SRP is about a class having one reason to change; ISP is about clients seeing only the methods they need. A class with one responsibility can still expose multiple role interfaces to different clients.

**Q: Where would you apply ISP in a parking lot?**
The entry gate needs `issue_ticket`, the exit gate needs `close_ticket` and `fee`, and the admin console needs `add_floor`. Each depends on a narrow role interface, even if one `ParkingLot` class implements them all.

**Q: Isn't Python duck-typed anyway?**
Yes, but declaring narrow Protocols documents intent and lets type checkers catch clients reaching for methods outside their role.

## Key takeaways

- Clients should depend only on what they use.
- Split by client role, not by implementation.
- Fat interfaces breed stubs, which breed LSP violations.
- One class can implement several small interfaces.
