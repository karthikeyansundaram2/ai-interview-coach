Producer-consumer decouples the code that creates work from the code that performs it, connecting them with a queue. Producers stay fast, consumers work at their own pace, and the queue absorbs bursts.

## The idea

At a busy restaurant, waiters (producers) pin order slips on a rail, and cooks (consumers) take slips off the rail as they become free. Waiters don't wait for food to be cooked before taking the next order. If the rail fills up, waiters have to pause, which is **backpressure**: a natural signal that the kitchen is overwhelmed.

```text
 Producers ──put──> [ bounded queue ] ──get──> Consumers (worker pool)
                         full: block / reject
```

## Why it matters

Many LLD designs include slow side effects: sending notifications, writing logs to disk, processing payments, dispatching elevator requests. Doing them inline makes the main operation slow and fragile. A queue:

- Lets the producer return immediately.
- Smooths bursty load.
- Allows scaling consumers independently.
- Isolates failures (a crashed consumer doesn't fail the request).

Python's `queue.Queue` is thread-safe and handles the locking and waiting for you.

```python
import queue
import threading
from dataclasses import dataclass

@dataclass(frozen=True)
class Notification:
    user_id: str
    text: str

_STOP = object()

class NotificationDispatcher:
    def __init__(self, workers: int = 3, capacity: int = 1000) -> None:
        self._q: queue.Queue[object] = queue.Queue(maxsize=capacity)
        self._threads = [threading.Thread(target=self._run, daemon=True)
                         for _ in range(workers)]
        for t in self._threads:
            t.start()

    def submit(self, n: Notification, timeout: float = 0.5) -> bool:
        try:
            self._q.put(n, timeout=timeout)   # blocks when full = backpressure
            return True
        except queue.Full:
            return False                      # caller can retry or drop

    def _run(self) -> None:
        while True:
            item = self._q.get()
            try:
                if item is _STOP:
                    return
                assert isinstance(item, Notification)
                print(f"{threading.current_thread().name} -> {item.user_id}: {item.text}")
            except Exception as exc:          # never let one bad item kill a worker
                print(f"failed: {exc!r}")
            finally:
                self._q.task_done()

    def shutdown(self) -> None:
        for _ in self._threads:
            self._q.put(_STOP)                # one poison pill per worker
        for t in self._threads:
            t.join()

d = NotificationDispatcher(workers=2)
for i in range(4):
    d.submit(Notification(f"u{i}", "Your order shipped"))
d.shutdown()
```

## When to use / when not to

Use it when work is slow, bursty, or can be done asynchronously: logging sinks, notification sending, order fulfilment steps, pub-sub brokers, and elevator request dispatch. Don't use it when the caller needs the result immediately to continue; in that case you need a synchronous call (or a future the caller awaits).

## Common mistakes

- **Unbounded queues**, which hide overload until memory runs out.
- Consumer threads dying on an exception and silently reducing capacity.
- No shutdown story: workers never stop, or items are lost on exit.
- Assuming ordering across multiple consumers; with N workers, completion order is not submission order. Partition by key if per-entity ordering matters.
- No retry or dead-letter handling for items that keep failing.

## In the interview

**Q: Why a bounded queue?**
It applies backpressure: when consumers fall behind, producers block or get rejected instead of the system silently accumulating unbounded work.

**Q: How do you guarantee per-user ordering with multiple consumers?**
Partition the work: hash the user ID to one of N queues, each with a single consumer, so a given user's events are processed in order.

**Q: How do you shut down cleanly?**
Stop accepting new work, put one sentinel per worker, and join the threads so in-flight items finish.

## Key takeaways

- A queue decouples producing work from doing it.
- Bound the queue to get backpressure.
- Protect workers from exceptions and plan shutdown.
- Partition by key when ordering matters.
