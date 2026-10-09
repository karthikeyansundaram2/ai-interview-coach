Template Method defines the fixed skeleton of an algorithm in a base class and lets subclasses fill in specific steps. The overall order never changes; only the details do.

## The idea

Every recipe for tea follows the same skeleton: boil water, add the leaves or bag, steep, then add extras. Masala chai and green tea differ only in *what* you add and *how long* you steep. The skeleton is fixed by the base recipe; each variety supplies its steps.

```text
 Base.run()            <- final skeleton, never overridden
   ├─ step_a()         <- common
   ├─ step_b()         <- abstract: subclass must implement
   ├─ hook()           <- optional: default no-op
   └─ step_c()         <- common
```

## Why it matters

When several workflows share structure but differ in a few steps, copy-pasting the structure invites drift. Template Method keeps the order and shared steps in one place and guarantees every variant follows it (for example, "always validate before saving, always audit after"). **Hooks** give optional extension points with default behaviour.

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class Report:
    title: str
    rows: list[dict[str, int]]

class ReportExporter(ABC):
    def export(self, report: Report) -> str:          # the template method
        if not report.rows:
            raise ValueError("empty report")
        header = self.header(report)
        body = "\n".join(self.row(r) for r in report.rows)
        footer = self.footer(report)                   # hook
        return "\n".join(part for part in (header, body, footer) if part)

    @abstractmethod
    def header(self, report: Report) -> str: ...

    @abstractmethod
    def row(self, r: dict[str, int]) -> str: ...

    def footer(self, report: Report) -> str:          # optional hook
        return ""

class CsvExporter(ReportExporter):
    def header(self, report: Report) -> str:
        return ",".join(report.rows[0].keys())

    def row(self, r: dict[str, int]) -> str:
        return ",".join(str(v) for v in r.values())

class MarkdownExporter(ReportExporter):
    def header(self, report: Report) -> str:
        cols = list(report.rows[0].keys())
        return f"| {' | '.join(cols)} |\n|{'---|' * len(cols)}"

    def row(self, r: dict[str, int]) -> str:
        return f"| {' | '.join(str(v) for v in r.values())} |"

    def footer(self, report: Report) -> str:
        return f"\n_{len(report.rows)} rows_"

rep = Report("Sales", [{"day": 1, "orders": 40}, {"day": 2, "orders": 55}])
print(CsvExporter().export(rep))
print(MarkdownExporter().export(rep))
```

## When to use / when not to

Use it when multiple variants share a stable sequence with a few varying steps: data import/export pipelines, game turn loops (`start_turn`, `make_move`, `check_end`), payment flows with provider-specific steps, or test fixtures. Prefer **Strategy** (composition) when variants might be combined, chosen at runtime, or when the skeleton itself varies; Template Method locks you into inheritance.

## Common mistakes

- Subclasses overriding the template method itself, breaking the guaranteed order. (Python has no `final` enforcement at runtime, but `typing.final` documents intent for type checkers.)
- Too many abstract steps, making each subclass implement trivial boilerplate; use hooks with defaults.
- Deep hierarchies where each level overrides a different step, making the flow hard to trace.
- Using it where a Strategy for one varying step would avoid inheritance altogether.

## In the interview

**Q: Template Method vs Strategy?**
Template Method varies steps inside a fixed algorithm via inheritance; Strategy swaps the entire algorithm via composition. I prefer Strategy when variants need to be mixed or chosen at runtime.

**Q: What is a hook?**
An optional step with a default (often no-op) implementation that subclasses may override, like `footer()` above.

**Q: Where in an LLD game problem?**
A `Game.play()` loop that is the same for every board game (`init`, loop over `take_turn` until `is_over`, `announce_winner`), with each game implementing the steps.

## Key takeaways

- Base class owns the algorithm's order; subclasses fill in steps.
- Hooks provide optional extension points with defaults.
- Great for shared workflows with small variations.
- Choose Strategy instead when you need runtime flexibility or composition.
