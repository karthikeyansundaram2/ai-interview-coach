Design an in-memory publish-subscribe message broker, a simplified Kafka: producers publish to topics, consumers in consumer groups read messages, and offsets track progress. It's a hard LLD problem because it is mostly about concurrency, delivery guarantees, and clean separation between storage and consumption.

## Requirements

**Functional**

- Create topics with a number of partitions.
- Producers publish messages (optional key) to a topic; messages with the same key go to the same partition (ordering per key).
- Consumers subscribe as part of a **consumer group**; each partition is consumed by exactly one consumer in a group, and every group gets every message.
- Consumers poll for messages and **commit offsets** after processing.
- At-least-once delivery: uncommitted messages are redelivered after consumer failure or restart.
- Message retention by time or size; consumers can reset offsets (replay).

**Non-functional**

- Thread-safe: many producers and consumers concurrently.
- Ordering guaranteed within a partition.
- Slow consumers must not block producers or other groups.
- Rebalancing when consumers join or leave a group.

## Core entities

| Entity | Responsibility |
| --- | --- |
| `Message` | Key, value, headers, timestamp; offset assigned on append |
| `Partition` | Append-only log with a lock and condition variable; read from offset |
| `Topic` | Name, list of partitions, `Partitioner` |
| `Partitioner` (strategy) | Key hash or round-robin |
| `ConsumerGroup` | Members, partition assignment, committed offsets per partition |
| `AssignmentStrategy` | Range or round-robin assignment of partitions to members |
| `Consumer` | Group member; polls assigned partitions; commits |
| `Producer` | Publishes messages, optionally batched |
| `Broker` | Facade: topics, groups, publish, poll, commit |

## Class design

```python
import itertools
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

@dataclass(frozen=True)
class Message:
    key: str | None
    value: Any
    offset: int = -1

class Partition:
    def __init__(self, pid: int) -> None:
        self.pid = pid
        self._log: list[Message] = []
        self._base_offset = 0                     # advances when retention trims
        self._cv = threading.Condition()

    def append(self, key: str | None, value: Any) -> int:
        with self._cv:
            offset = self._base_offset + len(self._log)
            self._log.append(Message(key, value, offset))
            self._cv.notify_all()
            return offset

    def read(self, offset: int, max_n: int, timeout: float) -> list[Message]:
        with self._cv:
            end = lambda: self._base_offset + len(self._log)
            if offset >= end():
                self._cv.wait(timeout)            # long poll
            start = max(offset, self._base_offset) - self._base_offset
            return self._log[start:start + max_n]

class Partitioner(ABC):
    @abstractmethod
    def pick(self, key: str | None, n: int) -> int: ...

class KeyHashPartitioner(Partitioner):
    def __init__(self) -> None:
        self._rr = itertools.count()

    def pick(self, key: str | None, n: int) -> int:
        return hash(key) % n if key is not None else next(self._rr) % n

@dataclass
class Topic:
    name: str
    partitions: list[Partition]
    partitioner: Partitioner

class ConsumerGroup:
    def __init__(self, group_id: str, topic: Topic) -> None:
        self.group_id, self.topic = group_id, topic
        self.members: list[str] = []
        self.assignment: dict[str, list[int]] = {}
        self.committed: dict[int, int] = {p.pid: 0 for p in topic.partitions}
        self.generation = 0
        self._lock = threading.Lock()

    def join(self, consumer_id: str) -> None: ...      # add + rebalance
    def leave(self, consumer_id: str) -> None: ...     # remove + rebalance

    def rebalance(self) -> None:
        with self._lock:
            self.generation += 1
            self.assignment = {m: [] for m in self.members}
            for pid in range(len(self.topic.partitions)):
                if self.members:
                    self.assignment[self.members[pid % len(self.members)]].append(pid)

    def commit(self, consumer_id: str, pid: int, next_offset: int, generation: int) -> None:
        with self._lock:
            if generation != self.generation or pid not in self.assignment.get(consumer_id, []):
                raise RuntimeError("stale consumer: partition reassigned")
            self.committed[pid] = max(self.committed[pid], next_offset)

class Broker:
    def __init__(self) -> None:
        self.topics: dict[str, Topic] = {}
        self.groups: dict[tuple[str, str], ConsumerGroup] = {}
        self._lock = threading.Lock()

    def create_topic(self, name: str, partitions: int) -> Topic: ...
    def publish(self, topic: str, key: str | None, value: Any) -> tuple[int, int]: ...
    def subscribe(self, topic: str, group_id: str, consumer_id: str) -> ConsumerGroup: ...
    def poll(self, topic: str, group_id: str, consumer_id: str,
             max_n: int = 100, timeout: float = 1.0) -> dict[int, list[Message]]: ...
```

## Key flows

1. **Publish**: `broker.publish(topic, key, value)` -> partitioner picks partition (same key -> same partition) -> `partition.append` under that partition's lock assigns the next offset and wakes waiting consumers -> return `(partition, offset)`.
2. **Subscribe**: consumer joins the group -> group rebalances (generation increments) -> each member gets a set of partitions.
3. **Poll**: for each assigned partition, read from the consumer's current position (initially the group's committed offset); long-poll if nothing is available.
4. **Process and commit**: after processing, commit `last_offset + 1` with the generation; stale generations are rejected so a consumer that lost a partition can't overwrite progress.
5. **Failure**: if a consumer stops heartbeating, it's removed and the group rebalances; its partitions resume from the last committed offset, so uncommitted messages are redelivered (at-least-once).
6. **Retention**: a background job trims messages older than the retention period; reads before the base offset jump forward.

## Patterns used

- **Observer / Pub-Sub**: producers and consumers are decoupled through topics; groups are independent subscribers.
- **Producer-consumer**: partitions are bounded-wait queues with condition variables for long polling.
- **Strategy**: `Partitioner` (key hash, round-robin, sticky) and partition `AssignmentStrategy` (range, round-robin).
- **Facade**: `Broker` exposes topic, group, publish, poll, and commit APIs.
- **Iterator (consumer side)**: a consumer can expose `for msg in consumer:` over polled batches.

## Concurrency & edge cases

- **Per-partition locks**: producers to different partitions never contend; ordering within a partition comes from serialised appends.
- **Group state** (members, assignment, offsets) behind a group lock, separate from partition locks; never hold both in nested order that could invert.
- **Zombie consumers** after rebalance: generation (epoch) fencing on commit.
- **Poison messages**: after N failed processing attempts, move to a dead-letter topic so the partition isn't blocked forever.
- **Consumer slower than retention**: its offset falls below the base offset; skip ahead and report data loss, or reset to earliest available.
- **Backpressure**: optional max partition size; producers block or get errors when full.

## Follow-ups the interviewer may ask

**How do you get exactly-once processing?**
The broker gives at-least-once; make consumers idempotent (dedupe by message ID or offset) or commit offsets atomically with the processing result in the same datastore.

**Why partitions instead of one queue per topic?**
Partitions allow parallel consumption while preserving order per key; one queue would force a single consumer or lose ordering.

**Queue semantics vs pub-sub semantics?**
Within one consumer group each message goes to one consumer (queue semantics); across groups every group gets every message (pub-sub). Consumer groups give both.

**How would you persist messages?**
Append each partition's log to segment files on disk with an offset index; reads use the index to seek; old segments are deleted for retention.
