Observer lets an object (the subject) notify a list of subscribers whenever something happens, without knowing who they are or what they do. It's the in-process version of publish/subscribe.

## The idea

When you subscribe to a YouTube channel, the channel doesn't know you personally. It keeps a list of subscribers and, when a new video is uploaded, notifies everyone on the list. Some subscribers get an email, some a push notification, some ignore it. Adding or removing subscribers never changes how the channel uploads videos.

```text
   Subject ──notifies──> [Observer A, Observer B, Observer C]
  (OrderService)          (Email)    (Analytics) (Inventory)
```

## Why it matters

Without Observer, the subject calls each downstream action directly: `place_order()` would call email, SMS, analytics, loyalty points, and inventory. Every new reaction means editing `place_order`. Observer inverts this: the subject publishes an event, and reactions subscribe. The subject becomes closed for modification and decoupled from consumers.

```python
from dataclasses import dataclass
from enum import Enum
from typing import Protocol

class OrderStatus(Enum):
    PLACED = "placed"
    OUT_FOR_DELIVERY = "out_for_delivery"

@dataclass(frozen=True)
class OrderEvent:
    order_id: str
    status: OrderStatus

class OrderObserver(Protocol):
    def on_order_event(self, event: OrderEvent) -> None: ...

class OrderTracker:
    def __init__(self) -> None:
        self._observers: list[OrderObserver] = []

    def subscribe(self, obs: OrderObserver) -> None:
        self._observers.append(obs)

    def unsubscribe(self, obs: OrderObserver) -> None:
        self._observers.remove(obs)

    def update_status(self, order_id: str, status: OrderStatus) -> None:
        event = OrderEvent(order_id, status)
        for obs in list(self._observers):    # copy: observers may unsubscribe
            try:
                obs.on_order_event(event)
            except Exception as exc:          # one bad observer can't break others
                print(f"observer failed: {exc!r}")

class CustomerPush:
    def on_order_event(self, event: OrderEvent) -> None:
        print(f"push: order {event.order_id} is {event.status.value}")

class Analytics:
    def __init__(self) -> None:
        self.counts: dict[OrderStatus, int] = {}

    def on_order_event(self, event: OrderEvent) -> None:
        self.counts[event.status] = self.counts.get(event.status, 0) + 1

tracker = OrderTracker()
for obs in (CustomerPush(), Analytics()):
    tracker.subscribe(obs)
tracker.update_status("o-9", OrderStatus.OUT_FOR_DELIVERY)
```

## When to use / when not to

Use Observer when one change triggers several independent reactions: order status updates, price alerts, game events, stock tickers, a parking lot display board updating on spot changes. Avoid it when there's exactly one consumer whose call is part of the core transaction (charging the card isn't an "observer" of checkout; it's a step). Also be careful when ordering between observers matters; Observer gives no ordering guarantees by design.

## Common mistakes

- Letting one failing observer abort the loop and starve the others.
- Slow observers (sending email) blocking the subject; dispatch to a queue or thread pool for heavy work.
- Memory leaks from observers that are never unsubscribed (consider weak references).
- Mutating the observer list while iterating it.
- Passing the whole mutable subject to observers instead of an immutable event.

## In the interview

**Q: Observer vs Pub/Sub?**
Observer is in-process and the subject holds direct references to observers. Pub/Sub adds a broker between publishers and subscribers, often across processes, so neither knows the other exists.

**Q: How do you handle slow subscribers?**
Notify asynchronously: push events into a queue consumed by worker threads, or hand off to a message broker, so the subject's operation stays fast.

**Q: Push or pull model?**
Push sends the event data to observers; pull sends a minimal signal and observers query the subject. Push with an immutable event object is simpler and avoids observers coupling to the subject's internals.

## Key takeaways

- Subject publishes; observers subscribe; neither depends on the other's concrete type.
- New reactions are new observers, not edits to the subject.
- Isolate observer failures and offload slow work.
- Pass immutable events, not the mutable subject.
