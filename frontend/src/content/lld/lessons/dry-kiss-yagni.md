DRY, KISS and YAGNI are three short rules that stop designs from bloating: don't duplicate knowledge, keep it simple, and don't build what nobody has asked for. In interviews they are the counterweight to pattern-happy over-engineering.

## The idea

Imagine packing for a weekend trip. **DRY**: keep one list of what you packed, not three slightly different ones. **KISS**: a backpack beats a modular luggage system with detachable wheels. **YAGNI**: you don't pack snow boots for Goa "just in case".

- **DRY (Don't Repeat Yourself)**: every piece of *knowledge* should have one authoritative home. It's about duplicated rules, not duplicated characters.
- **KISS (Keep It Simple)**: prefer the simplest design that meets the requirements; complexity must justify itself.
- **YAGNI (You Aren't Gonna Need It)**: don't build features or extension points for hypothetical future needs.

## Why it matters

Duplicated rules drift apart: the GST rate gets updated in the invoice but not in the cart. Unnecessary complexity costs reading time forever. Speculative features must be tested, maintained, and understood by people who will never use them.

```python
from dataclasses import dataclass

# DRY: the late-fee rule lives in exactly one place.
LATE_FEE_PER_DAY = 10
MAX_LATE_FEE = 500

def late_fee(days_late: int) -> int:
    return min(max(days_late, 0) * LATE_FEE_PER_DAY, MAX_LATE_FEE)

@dataclass
class Loan:
    book_id: str
    days_late: int

    def fee(self) -> int:
        return late_fee(self.days_late)   # reuse, don't re-derive

def monthly_report(loans: list[Loan]) -> int:
    return sum(loan.fee() for loan in loans)   # same rule, same source

# KISS: a dict is enough for a small lookup; no Strategy hierarchy needed.
MEMBERSHIP_LIMITS = {"basic": 2, "premium": 5}

def can_borrow(tier: str, current_loans: int) -> bool:
    return current_loans < MEMBERSHIP_LIMITS[tier]

# YAGNI: no `currency` parameter, no plugin system for fee rules,
# because nobody asked for multi-currency or custom fee plugins.
print(monthly_report([Loan("b1", 3), Loan("b2", 80)]))  # 30 + 500
print(can_borrow("basic", 2))                             # False
```

## When to use / when not to

These principles pull against each other and against patterns, which is the point. DRY can be overapplied: two pieces of code that look the same but represent *different* rules (say, a seat-hold timeout and a session timeout that both happen to be 10 minutes) should stay separate, because they will change for different reasons. Premature DRY creates wrong abstractions that are harder to undo than duplication.

In interviews, balance YAGNI against extensibility. The interviewer *will* ask "what if we add X?", so it's fine to put an interface at an obvious variation point. It's not fine to build a plugin framework for things they never hinted at.

## Common mistakes

- Merging coincidentally similar code into one function with boolean flags (`calculate(x, is_refund=True, legacy=False)`).
- Applying three patterns to a problem that needed a dict and a function.
- Justifying complexity with "we might need it later".
- Copy-pasting validation into every endpoint instead of putting it in the domain object.

## In the interview

**Q: When is duplication acceptable?**
When the duplicated code represents different knowledge that may evolve independently. The "rule of three" helps: abstract on the third occurrence, once the shape is clear.

**Q: How do you avoid over-engineering in a 45-minute LLD round?**
Design for the clarified requirements, put abstractions only at variation points the interviewer cares about, and mention further extensibility verbally instead of coding it.

**Q: Isn't adding interfaces everywhere a violation of YAGNI?**
It can be. I add interfaces for external dependencies and real variation points, and keep everything else concrete.

## Key takeaways

- DRY is about single sources of *knowledge*, not identical-looking lines.
- KISS: complexity must pay rent.
- YAGNI: design for today's requirements plus the obvious next step, no more.
- Wrong abstractions cost more than duplication.
