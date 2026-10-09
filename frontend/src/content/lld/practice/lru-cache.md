Design a Least Recently Used (LRU) cache with fixed capacity and O(1) `get` and `put`. It's a classic because it mixes data-structure knowledge (hash map plus doubly linked list) with design concerns like pluggable eviction and thread safety.

## Requirements

**Functional**

- `get(key)` returns the value or a miss indicator, and marks the key as most recently used.
- `put(key, value)` inserts or updates; if capacity is exceeded, evict the least recently used entry.
- Fixed capacity set at construction.
- Optional: TTL per entry, eviction callback, hit/miss stats, pluggable eviction policy (LFU, FIFO).

**Non-functional**

- O(1) average time for `get` and `put`.
- Thread-safe for concurrent readers and writers.
- Generic over key and value types.

## Core entities

| Entity | Responsibility |
| --- | --- |
| `Node` | Key, value, prev/next pointers (and optional expiry) |
| `DoublyLinkedList` | O(1) add-to-front, remove node, remove-from-tail, with sentinel head/tail |
| `EvictionPolicy` (interface) | Records access/insert, picks a victim key |
| `LRUPolicy` | DLL-backed recency ordering |
| `Cache` | Hash map from key to value/node, capacity, lock, stats; delegates ordering to policy |

## Class design

```python
from __future__ import annotations
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Callable, Generic, Hashable, TypeVar

K = TypeVar("K", bound=Hashable)
V = TypeVar("V")

class Node(Generic[K]):
    __slots__ = ("key", "prev", "next")

    def __init__(self, key: K | None = None) -> None:
        self.key = key
        self.prev: Node[K] | None = None
        self.next: Node[K] | None = None

class DoublyLinkedList(Generic[K]):
    def __init__(self) -> None:
        self.head, self.tail = Node[K](), Node[K]()    # sentinels
        self.head.next, self.tail.prev = self.tail, self.head

    def push_front(self, node: Node[K]) -> None: ...
    def remove(self, node: Node[K]) -> None: ...
    def pop_back(self) -> Node[K] | None: ...

class EvictionPolicy(ABC, Generic[K]):
    @abstractmethod
    def on_access(self, key: K) -> None: ...
    @abstractmethod
    def on_insert(self, key: K) -> None: ...
    @abstractmethod
    def on_delete(self, key: K) -> None: ...
    @abstractmethod
    def victim(self) -> K | None: ...

class LRUPolicy(EvictionPolicy[K]):
    def __init__(self) -> None:
        self._list = DoublyLinkedList[K]()
        self._nodes: dict[K, Node[K]] = {}

    def on_access(self, key: K) -> None:
        node = self._nodes[key]
        self._list.remove(node)
        self._list.push_front(node)

    def on_insert(self, key: K) -> None: ...
    def on_delete(self, key: K) -> None: ...
    def victim(self) -> K | None: ...                  # tail.prev key

@dataclass
class CacheStats:
    hits: int = 0
    misses: int = 0
    evictions: int = 0

class Cache(Generic[K, V]):
    def __init__(self, capacity: int, policy: EvictionPolicy[K] | None = None,
                 on_evict: Callable[[K, V], None] | None = None) -> None:
        if capacity <= 0:
            raise ValueError("capacity must be positive")
        self.capacity = capacity
        self._data: dict[K, V] = {}
        self._policy = policy or LRUPolicy[K]()
        self._on_evict = on_evict
        self._lock = threading.Lock()
        self.stats = CacheStats()

    def get(self, key: K) -> V | None: ...
    def put(self, key: K, value: V) -> None: ...
    def delete(self, key: K) -> bool: ...
```

## Key flows

1. **get(key)** under the lock: if absent, increment misses and return `None`. Otherwise `policy.on_access(key)` (move node to front), increment hits, return value.
2. **put(key, value)** under the lock:
   1. If the key exists, update value and `policy.on_access(key)`.
   2. Else, if `len(data) == capacity`, `victim = policy.victim()`, remove from `data`, `policy.on_delete(victim)`, increment evictions, and record the evicted pair for the callback.
   3. Insert into `data`, `policy.on_insert(key)` (push to front).
3. **Eviction callback** runs *after* releasing the lock so slow callbacks don't block the cache.

## Patterns used

- **Strategy**: `EvictionPolicy` makes LRU, LFU, or FIFO swappable; the cache's map logic stays the same.
- **Observer (light)**: the `on_evict` callback lets callers react to evictions (write-back, metrics).
- **Sentinel nodes**: not a GoF pattern, but they remove edge cases for empty lists and head/tail updates.
- **Decorator (optional)**: a `TTLCache` wrapper or a `StatsCache` wrapper adds behaviour without changing the core.

## Concurrency & edge cases

- **Even `get` mutates** (it reorders the list), so a plain read-write lock doesn't help; use a single mutex, or **lock striping**: shard the cache into K segments by `hash(key) % K`, each an independent LRU with its own lock. This trades exact global LRU for throughput.
- Callbacks outside the lock to avoid deadlocks and latency spikes.
- **Capacity 1**, updating an existing key at full capacity (must not evict), and deleting a non-existent key.
- **`None` as a value**: return a sentinel or raise `KeyError` instead of overloading `None`.
- **TTL**: store expiry on entries; check lazily on `get` and optionally sweep periodically.

## Follow-ups the interviewer may ask

**Why a doubly linked list rather than a singly linked one?**
Removing an arbitrary node in O(1) needs its predecessor, which only a doubly linked list gives you directly.

**Can you use `OrderedDict`?**
Yes, `move_to_end` and `popitem(last=False)` give O(1) LRU, and it's a fine production answer. In interviews, show you know the underlying structure first.

**How would you implement LFU?**
Map key to frequency, and frequency to an ordered set of keys; track the minimum frequency. Evict the least recently used key in the minimum-frequency bucket. O(1) per operation.

**How do you scale this across machines?**
Partition keys across nodes with consistent hashing; each node runs a local LRU. That's how Memcached-style clusters work.

**How do you avoid a stampede when a hot key expires?**
Single-flight: the first miss loads the value while concurrent misses for the same key wait on that load (a per-key future), instead of all hitting the backend.
