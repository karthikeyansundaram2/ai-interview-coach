Abstract Factory creates whole *families* of related objects that are designed to work together, ensuring you never mix, say, a dark-theme button with a light-theme dialog, or a sandbox payment client with a production refund client.

## The idea

When you furnish a room from one furniture collection, the sofa, table, and chairs match. You pick the collection once ("Scandinavian") and every piece follows. An Abstract Factory is that collection: one interface with a `create_*` method per product, and one concrete factory per family.

```text
        <<interface>> PaymentFactory
        + create_charger(): Charger
        + create_refunder(): Refunder
              ▲                 ▲
              │                 │
     RazorpayFactory      StripeFactory
     (RazorpayCharger,    (StripeCharger,
      RazorpayRefunder)    StripeRefunder)
```

## Why it matters

Some objects only make sense together: a charger and refunder must talk to the same provider and account; UI widgets must share a theme; a test environment needs fake versions of every external client. Abstract Factory enforces that consistency by construction. Client code receives one factory and can't accidentally mix families.

```python
from abc import ABC, abstractmethod

class Charger(ABC):
    @abstractmethod
    def charge(self, amount: int) -> str: ...

class Refunder(ABC):
    @abstractmethod
    def refund(self, charge_id: str) -> bool: ...

class PaymentFactory(ABC):
    @abstractmethod
    def create_charger(self) -> Charger: ...
    @abstractmethod
    def create_refunder(self) -> Refunder: ...

class RazorpayCharger(Charger):
    def charge(self, amount: int) -> str:
        return f"rzp_ch_{amount}"

class RazorpayRefunder(Refunder):
    def refund(self, charge_id: str) -> bool:
        return charge_id.startswith("rzp_")

class RazorpayFactory(PaymentFactory):
    def create_charger(self) -> Charger:
        return RazorpayCharger()

    def create_refunder(self) -> Refunder:
        return RazorpayRefunder()

class FakeGateway(Charger, Refunder):        # one test double plays both roles
    def charge(self, amount: int) -> str:
        return "fake_ch"
    def refund(self, charge_id: str) -> bool:
        return True

class FakePaymentFactory(PaymentFactory):
    def create_charger(self) -> Charger:
        return FakeGateway()
    def create_refunder(self) -> Refunder:
        return FakeGateway()

def checkout_and_cancel(factory: PaymentFactory, amount: int) -> bool:
    ch_id = factory.create_charger().charge(amount)
    return factory.create_refunder().refund(ch_id)   # guaranteed same family

print(checkout_and_cancel(RazorpayFactory(), 499))      # True
print(checkout_and_cancel(FakePaymentFactory(), 499))   # True
```

## When to use / when not to

Use it when you have multiple products that vary together by a single dimension (provider, platform, region, environment) and mixing them would be a bug. Don't use it for a single product type; that's just a Factory Method. And be aware of its main cost: adding a new *product* (say, `Payouts`) means changing the interface and every concrete factory.

## Common mistakes

- Using Abstract Factory when there's only one product, adding a layer for nothing.
- Letting clients still construct some family members directly, defeating the consistency guarantee.
- Building factories with dozens of `create_*` methods; split the family if it's that large.
- Confusing it with a registry-based simple factory.

## In the interview

**Q: Abstract Factory vs Factory Method?**
Factory Method creates one product and lets subclasses or a mapping choose its type. Abstract Factory groups several factory methods so a whole family of compatible products comes from one place.

**Q: What's the trade-off?**
Adding a new family is easy (one new factory class), but adding a new product type touches every factory.

**Q: Where might it appear in LLD?**
Multi-provider payments, region-specific tax and invoice generators, or a game that supports multiple rule sets where the board, pieces, and validator must match.

## Key takeaways

- Abstract Factory produces families of objects that must be used together.
- One factory per family; one `create_*` per product.
- Easy to add families, harder to add products.
- Great for swapping whole environments, such as real vs fake clients.
