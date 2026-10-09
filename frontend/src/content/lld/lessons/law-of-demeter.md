The Law of Demeter says a method should only talk to its immediate collaborators, not reach through them to grab their internals. Code like `order.customer.wallet.balance` is a sign you're depending on a chain of objects you don't own.

## The idea

When you buy something at a shop, you hand the cashier money. You don't reach into the cashier's pocket, pull out their wallet, and take change yourself. You ask; they handle it. The Law of Demeter, often summarised as "talk to friends, not strangers", says the same thing about objects.

A method `m` of object `O` may call methods on:

- `O` itself,
- `m`'s parameters,
- objects `m` creates,
- `O`'s direct fields.

It should not call methods on objects *returned* by those calls. Each extra dot is another dependency on someone else's structure.

## Why it matters

Long chains like `a.b().c().d()` couple your code to the internal shape of three other classes. If `Customer` stops holding a `Wallet` directly, every chain breaks. Demeter also pushes logic to where the data lives, which is good encapsulation ("tell, don't ask").

```python
from dataclasses import dataclass

@dataclass
class Wallet:
    balance: int

    def debit(self, amount: int) -> None:
        if amount > self.balance:
            raise ValueError("insufficient balance")
        self.balance -= amount

@dataclass
class Customer:
    name: str
    _wallet: Wallet

    def pay(self, amount: int) -> None:   # tell, don't ask
        self._wallet.debit(amount)

    def can_afford(self, amount: int) -> bool:
        return self._wallet.balance >= amount

@dataclass
class Order:
    total: int
    customer: Customer

class Checkout:
    def complete(self, order: Order) -> None:
        # Violation: order.customer._wallet.balance -= order.total
        # Checkout would depend on Customer AND Wallet internals.
        order.customer.pay(order.total)   # one hop, behaviour stays with owner

c = Customer("karthi", Wallet(1000))
Checkout().complete(Order(400, c))
print(c.can_afford(700))  # False
```

## When to use / when not to

Apply it to domain objects with behaviour: orders, accounts, games, bookings. It does **not** apply to fluent APIs and builders (`query.filter(...).order_by(...)`), where each call returns the same kind of object by design, nor to plain data structures and DTOs (`config.db.host` is fine; it's just data).

## Common mistakes

- Counting dots mechanically instead of asking "am I depending on internal structure?".
- Fixing violations by adding dozens of pure forwarding methods (`customer.get_wallet_balance_currency_code()`); if you need many, the responsibility probably belongs elsewhere.
- Applying it to data records, where reaching into fields is expected.
- Asking for data, making a decision, then writing data back, instead of telling the owner to decide.

## In the interview

**Q: What's wrong with `ride.driver.vehicle.location.update(x)`?**
The caller depends on the internal structure of three classes. Better: `ride.driver.update_location(x)` or have the driver own location updates, so the chain can change without breaking callers.

**Q: Does a fluent builder violate Demeter?**
No. Each call returns the builder itself, so you're still talking to the same friend.

**Q: How does Demeter relate to "tell, don't ask"?**
Both push behaviour to where the data lives: instead of pulling state out to make decisions, tell the owner what you want done.

## Key takeaways

- Talk to direct collaborators, not their internals.
- Long chains signal coupling to structure you don't own.
- "Tell, don't ask" is the usual fix.
- Fluent APIs and plain data objects are fine exceptions.
