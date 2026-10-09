Design a rate limiter that limits how many requests each client can make in a time window, with swappable algorithms. In LLD rounds the focus is on clean algorithm abstractions, correct time handling, and thread safety; distributed concerns usually come up as follow-ups.

## Requirements

**Functional**

- `allow(client_id) -> bool` decides whether a request is permitted.
- Limits configurable per client or tier (e.g. free: 10 req/s, pro: 100 req/s) and per API (e.g. `/login` stricter).
- Support multiple algorithms: fixed window, sliding window log, sliding window counter, token bucket, leaky bucket.
- Return metadata for rejected requests: retry-after, remaining quota (for `429` headers).

**Non-functional**

- O(1) or close to it per decision; tiny memory per client.
- Thread-safe for concurrent requests.
- Clock injectable for testing.
- Low latency; never become the bottleneck.

## Core entities

| Entity | Responsibility |
| --- | --- |
| `RateLimitRule` | Limit, window/refill rate, algorithm name, scope |
| `Decision` | Allowed flag, remaining, retry-after |
| `RateLimitAlgorithm` (interface) | Per-key decision logic and state |
| `TokenBucket`, `SlidingWindowLog`, `FixedWindow`, `SlidingWindowCounter` | Concrete algorithms |
| `RuleResolver` | Maps (client, endpoint) to a rule |
| `RateLimiter` | Facade: resolves rule, picks algorithm instance, returns decision |
| `Clock` | Time source (injectable) |

## Class design

```python
import threading
import time
from abc import ABC, abstractmethod
from collections import deque
from dataclasses import dataclass
from typing import Protocol

class Clock(Protocol):
    def now(self) -> float: ...

class MonotonicClock:
    def now(self) -> float:
        return time.monotonic()

@dataclass(frozen=True)
class RateLimitRule:
    limit: int            # max requests (or bucket capacity)
    window_s: float       # window length (or time to refill a full bucket)
    algorithm: str = "token_bucket"

@dataclass(frozen=True)
class Decision:
    allowed: bool
    remaining: int
    retry_after_s: float = 0.0

class RateLimitAlgorithm(ABC):
    def __init__(self, rule: RateLimitRule, clock: Clock) -> None:
        self.rule, self.clock = rule, clock
        self._lock = threading.Lock()

    @abstractmethod
    def try_acquire(self, key: str) -> Decision: ...

class TokenBucket(RateLimitAlgorithm):
    def __init__(self, rule: RateLimitRule, clock: Clock) -> None:
        super().__init__(rule, clock)
        self._rate = rule.limit / rule.window_s          # tokens per second
        self._state: dict[str, tuple[float, float]] = {}  # key -> (tokens, last_ts)

    def try_acquire(self, key: str) -> Decision:
        with self._lock:
            now = self.clock.now()
            tokens, last = self._state.get(key, (float(self.rule.limit), now))
            tokens = min(self.rule.limit, tokens + (now - last) * self._rate)
            if tokens >= 1:
                self._state[key] = (tokens - 1, now)
                return Decision(True, int(tokens - 1))
            self._state[key] = (tokens, now)
            return Decision(False, 0, (1 - tokens) / self._rate)

class SlidingWindowLog(RateLimitAlgorithm):
    def __init__(self, rule: RateLimitRule, clock: Clock) -> None:
        super().__init__(rule, clock)
        self._log: dict[str, deque[float]] = {}

    def try_acquire(self, key: str) -> Decision: ...   # evict old ts, compare len

class FixedWindow(RateLimitAlgorithm): ...
class SlidingWindowCounter(RateLimitAlgorithm): ...    # weighted prev + current window

class AlgorithmFactory:
    _registry: dict[str, type[RateLimitAlgorithm]] = {
        "token_bucket": TokenBucket, "sliding_log": SlidingWindowLog,
        "fixed_window": FixedWindow, "sliding_counter": SlidingWindowCounter,
    }

    @classmethod
    def create(cls, rule: RateLimitRule, clock: Clock) -> RateLimitAlgorithm:
        return cls._registry[rule.algorithm](rule, clock)

class RuleResolver(Protocol):
    def resolve(self, client_id: str, endpoint: str) -> RateLimitRule: ...

class RateLimiter:
    def __init__(self, rules: RuleResolver, clock: Clock = MonotonicClock()) -> None:
        self._rules, self._clock = rules, clock
        self._algos: dict[RateLimitRule, RateLimitAlgorithm] = {}
        self._lock = threading.Lock()

    def allow(self, client_id: str, endpoint: str) -> Decision:
        rule = self._rules.resolve(client_id, endpoint)
        with self._lock:
            algo = self._algos.get(rule) or self._algos.setdefault(
                rule, AlgorithmFactory.create(rule, self._clock))
        return algo.try_acquire(f"{client_id}:{endpoint}")
```

## Key flows

1. **Request arrives**: middleware calls `limiter.allow(client_id, endpoint)`.
2. **Resolve rule**: the resolver checks client overrides, then tier defaults, then endpoint defaults.
3. **Get algorithm instance**: one instance per distinct rule, created lazily via the factory (algorithms keep per-key state internally).
4. **Decide**: e.g. token bucket refills tokens based on elapsed time, consumes one if available.
5. **Respond**: allowed requests continue; rejected ones return `429` with `Retry-After` and `X-RateLimit-Remaining`.

## Patterns used

- **Strategy**: each algorithm implements `RateLimitAlgorithm`; the limiter doesn't care which.
- **Factory with registry**: creates the right algorithm from the rule's name; new algorithms register without edits.
- **Facade**: `RateLimiter.allow` hides rule resolution and algorithm selection.
- **Proxy / middleware**: in practice the limiter sits in front of the service as a proxy or a Chain-of-Responsibility link.
- **Dependency injection**: `Clock` makes time deterministic in tests.

## Concurrency & edge cases

- Read-modify-write of bucket state must be atomic: a lock per algorithm instance is simple; **lock striping** (N locks by key hash) reduces contention for hot instances.
- Use a **monotonic clock**, not wall-clock time, so NTP adjustments don't refill or drain buckets.
- **Memory growth**: evict idle keys (e.g. a TTL sweep or an LRU of keys).
- **Fixed window burst**: a client can send 2x the limit across a window boundary; mention why sliding window or token bucket fixes it.
- **Sliding window log memory**: O(limit) timestamps per key; the sliding window counter approximates it in O(1).

## Follow-ups the interviewer may ask

**Compare the algorithms.**
Fixed window is simplest but bursty at edges. Sliding log is exact but memory-heavy. Sliding counter is an O(1) approximation. Token bucket allows controlled bursts up to capacity with a steady refill and is the common default. Leaky bucket smooths output to a constant rate.

**How do you make it distributed?**
Store per-key state in Redis and run the check-and-update atomically in a Lua script (or use `INCR` with expiry for fixed windows). Accept a few milliseconds of latency, or use local limiters with a share of the global quota for very hot paths.

**What happens if Redis is down?**
Choose fail-open (allow, protect availability) or fail-closed (deny, protect the backend) per endpoint; usually fail-open with a local fallback limiter.

**How would you support different limits per tier?**
The `RuleResolver` maps clients to tiers and tiers to rules; changes are configuration only.
