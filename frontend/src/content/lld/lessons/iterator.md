Iterator gives a uniform way to walk through a collection one element at a time without exposing how the collection is stored. In Python it's built into the language, so the skill is knowing how to use the protocol well.

## The idea

A TV remote's "next channel" button walks through channels without you knowing whether the TV stores them in an array, a linked list, or fetches them from a satellite. You just press next until you've seen what you want. That button is an iterator.

## Why it matters

- **Encapsulation**: callers don't depend on the internal structure (list, tree, paginated API).
- **Multiple traversals**: a tree can offer in-order, level-order, or filtered iteration.
- **Laziness**: elements can be produced on demand, which matters for large or infinite sequences and paginated I/O.

Python's iterator protocol is `__iter__` (returns an iterator) and `__next__` (returns the next item or raises `StopIteration`). Generator functions using `yield` implement it for you, and that's the idiomatic approach.

```python
from collections.abc import Iterator
from dataclasses import dataclass, field

@dataclass
class Employee:
    name: str
    reports: list["Employee"] = field(default_factory=list)

class OrgChart:
    def __init__(self, ceo: Employee) -> None:
        self._root = ceo

    def __iter__(self) -> Iterator[Employee]:        # default: depth-first
        stack = [self._root]
        while stack:
            emp = stack.pop()
            yield emp
            stack.extend(reversed(emp.reports))

    def by_level(self) -> Iterator[tuple[int, Employee]]:   # alternate traversal
        level, current = 0, [self._root]
        while current:
            for emp in current:
                yield level, emp
            current = [r for emp in current for r in emp.reports]
            level += 1

def paginated_orders(fetch_page, page_size: int = 100) -> Iterator[dict]:
    """Hide pagination behind a flat, lazy iterator."""
    cursor: str | None = None
    while True:
        items, cursor = fetch_page(cursor, page_size)
        yield from items
        if cursor is None:
            return

cto = Employee("CTO", [Employee("EM-1"), Employee("EM-2")])
org = OrgChart(Employee("CEO", [cto, Employee("CFO")]))
print([e.name for e in org])                         # CEO, CTO, EM-1, EM-2, CFO
print([(lvl, e.name) for lvl, e in org.by_level()])
```

## When to use / when not to

Implement custom iteration when your collection has a non-trivial structure (trees, graphs, boards, composite menus), when you want lazy traversal over expensive sources (database cursors, paginated APIs, log files), or when you want several traversal orders. Don't build a custom iterator class when returning a list or using a generator expression is enough.

## Common mistakes

- Making the collection its own iterator (`__iter__` returns `self` with internal position), so two loops over it interfere. Return a fresh generator instead.
- Modifying a collection while iterating over it.
- Materialising huge results into lists when a generator would stream them.
- Exposing internal lists to callers "for iteration" so they can mutate them.

## In the interview

**Q: What's the difference between an iterable and an iterator?**
An iterable can produce a fresh iterator via `__iter__`; an iterator tracks position and yields items via `__next__`. Containers should be iterables so multiple traversals don't collide.

**Q: Where does Iterator appear in LLD problems?**
Traversing a composite menu or file system, iterating over a game board's cells, or streaming log entries from a logging framework's file sink.

**Q: How do you iterate safely while another thread modifies the collection?**
Iterate over a snapshot taken under a lock, or use a concurrent structure with weakly consistent iteration semantics.

## Key takeaways

- Iterator hides storage and gives uniform traversal.
- In Python, prefer generators with `yield` over hand-written iterator classes.
- Return fresh iterators so multiple loops don't interfere.
- Use lazy iteration for large or paginated data.
