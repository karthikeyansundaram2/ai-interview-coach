Composite lets you treat a single object and a group of objects through the same interface, so you can build trees and ask the whole tree a question with one call.

## The idea

A company's org chart: an engineer has a salary; a team has a total salary equal to the sum of its members; a department's total is the sum of its teams. When the CFO asks "what does this unit cost?", the same question works for one person or the entire company. Leaves answer directly; groups ask their children and combine the answers.

```text
          Menu (composite)
         /       |       \
   Starters    Mains     Paneer Tikka (leaf)
   /    \        |
 Soup  Salad   Biryani
```

## Why it matters

Without Composite, clients must constantly check "is this a single item or a group?" and recurse manually. With it, recursion lives inside the structure, and clients work uniformly. It's the natural model for file systems, menus, org charts, UI component trees, bundles of products, and nested permissions.

```python
from abc import ABC, abstractmethod

class MenuComponent(ABC):
    def __init__(self, name: str) -> None:
        self.name = name

    @abstractmethod
    def price(self) -> int: ...

    @abstractmethod
    def render(self, indent: int = 0) -> list[str]: ...

class MenuItem(MenuComponent):                 # leaf
    def __init__(self, name: str, price: int) -> None:
        super().__init__(name)
        self._price = price

    def price(self) -> int:
        return self._price

    def render(self, indent: int = 0) -> list[str]:
        return [f"{'  ' * indent}{self.name}  Rs {self._price}"]

class Combo(MenuComponent):                    # composite
    def __init__(self, name: str, discount_pct: int = 0) -> None:
        super().__init__(name)
        self._children: list[MenuComponent] = []
        self._discount = discount_pct

    def add(self, item: MenuComponent) -> "Combo":
        self._children.append(item)
        return self

    def price(self) -> int:
        total = sum(c.price() for c in self._children)
        return total * (100 - self._discount) // 100

    def render(self, indent: int = 0) -> list[str]:
        lines = [f"{'  ' * indent}{self.name}  Rs {self.price()}"]
        for c in self._children:
            lines.extend(c.render(indent + 1))
        return lines

lunch = Combo("Lunch Combo", discount_pct=10)
lunch.add(MenuItem("Veg Biryani", 220)).add(MenuItem("Raita", 40))
family = Combo("Family Pack").add(lunch).add(lunch).add(MenuItem("Gulab Jamun", 80))
print("\n".join(family.render()))
print(family.price())   # 2 * 234 + 80 = 548
```

## When to use / when not to

Use Composite when you have part-whole hierarchies and clients should treat leaves and groups the same: product bundles, nested folders, organisational units, expression trees, or nested permission groups. Don't force it on flat collections, or when leaves and groups need very different operations; a shared interface full of methods that make no sense for leaves is a design smell.

## Common mistakes

- Putting `add`/`remove` on the shared interface so leaves must raise errors (a transparency vs safety trade-off; prefer keeping them on the composite).
- Not guarding against cycles (a group containing itself) in user-editable trees.
- Recomputing expensive aggregates on every call for deep trees; consider caching with invalidation.
- Using it when the hierarchy has a fixed depth that simple classes model more clearly.

## In the interview

**Q: Where does Composite appear in LLD problems?**
File systems (files and directories), restaurant menus with combos, organisation hierarchies in expense approval, and nested categories in inventory.

**Q: Should `add_child` be on the base interface?**
Putting it on the base gives uniformity but forces leaves to reject it. I keep child management on the composite and the shared operations (`price`, `size`) on the base.

**Q: How do you compute size for a huge directory tree efficiently?**
Cache aggregates at each node and invalidate up the parent chain on changes, so queries stay cheap.

## Key takeaways

- Leaves and composites share one interface; composites delegate to children.
- Clients treat single items and whole trees uniformly.
- Keep child-management methods off the leaf interface when possible.
- Watch for cycles and expensive repeated aggregation.
