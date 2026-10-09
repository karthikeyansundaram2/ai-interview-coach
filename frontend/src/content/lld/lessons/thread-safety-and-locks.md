Most LLD problems have a hidden concurrency question: two cars arrive at the last spot, two users click the same seat, two threads hit the same cache key. Knowing where shared mutable state lives and how to protect it is what separates a senior answer from a junior one.

## The idea

A single bathroom in an office has a lock on the door. Whoever goes in locks it; everyone else waits. The lock makes "check if free, then use it" a single uninterruptible step. Without it, two people check "free" at the same moment and both walk in.

That's a **race condition**: correctness depends on timing. The most common shape is **check-then-act**: read some state, decide, then write, with another thread changing the state in between.

## Why it matters

Python's GIL does *not* make your code thread-safe. It prevents two threads from executing bytecode simultaneously, but a thread can be switched out between any two bytecodes, so `if spot.free: spot.free = False` can interleave.

```python
import threading
from dataclasses import dataclass, field

@dataclass
class Spot:
    spot_id: str
    vehicle: str | None = None

@dataclass
class Floor:
    spots: list[Spot]
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def park_unsafe(self, plate: str) -> Spot | None:
        for s in self.spots:
            if s.vehicle is None:        # check
                s.vehicle = plate        # act: another thread may have won in between
                return s
        return None

    def park(self, plate: str) -> Spot | None:
        with self._lock:                 # check-then-act is now atomic
            for s in self.spots:
                if s.vehicle is None:
                    s.vehicle = plate
                    return s
        return None

    def leave(self, spot_id: str) -> None:
        with self._lock:
            for s in self.spots:
                if s.spot_id == spot_id:
                    s.vehicle = None

floor = Floor([Spot("A1")])
winners: list[Spot | None] = []
threads = [threading.Thread(target=lambda p=p: winners.append(floor.park(p)))
           for p in ("TN01", "TN02", "TN03")]
for t in threads: t.start()
for t in threads: t.join()
print(sum(w is not None for w in winners))   # always exactly 1
```

## Choosing the lock

| Tool | Use when |
| --- | --- |
| `Lock` | Simple mutual exclusion around a critical section |
| `RLock` | The same thread may re-enter (method calls method under lock) |
| `Condition` | Threads wait for a state change (queue not empty) |
| `Semaphore` | Limit concurrent access to N (connection pool) |
| Lock striping | Many keys; hash key to one of K locks to bound lock count |

**Granularity** is the key trade-off: one global lock is simple but serialises everything; per-entity locks scale but risk **deadlock** when you acquire several. Avoid deadlock by always acquiring multiple locks in a consistent order (for example, sorted by ID), and by holding locks as briefly as possible, never across I/O.

## When to use / when not to

Lock any shared mutable state accessed by more than one thread. Avoid locking by design where you can: immutable objects, thread confinement (one owner thread), or message passing via queues. In distributed designs, push atomicity to the datastore (conditional writes, transactions) rather than in-process locks.

## Common mistakes

- Assuming the GIL makes compound operations atomic.
- Locking writes but not reads that depend on multiple fields.
- Holding a lock while doing network calls or sleeping.
- Acquiring two locks in different orders in different code paths (deadlock).
- A single global lock in a design where the interviewer cares about throughput.

## In the interview

**Q: How do you prevent two cars getting the same spot?**
Make "find a free spot and mark it occupied" atomic under a lock, ideally per floor or per spot type so unrelated parks don't block each other. Across servers, use a conditional update in the datastore.

**Q: How do you avoid deadlocks?**
Global lock ordering, minimal lock scope, timeouts with `acquire(timeout=...)`, and preferring single-lock designs.

**Q: Does Python's GIL help?**
Only for single bytecode operations. Check-then-act sequences still race, so explicit locks are required.

## Key takeaways

- Find check-then-act sequences on shared state; make them atomic.
- The GIL is not a substitute for locks.
- Choose lock granularity deliberately; finer scales better but risks deadlock.
- Prefer immutability, confinement, and queues to reduce what needs locking.
