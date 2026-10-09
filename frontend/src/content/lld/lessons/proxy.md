A Proxy is a stand-in object with the same interface as the real one, controlling access to it. It can delay creating the real object, check permissions, cache results, or hide that the real object lives on another machine.

## The idea

A company receptionist answers calls for the CEO. Callers think they're reaching the CEO's line, but the receptionist decides whether to put them through, takes messages, or answers common questions directly. The CEO's interface ("call this number") is unchanged; access is controlled.

Common kinds of proxy:

| Kind | Purpose |
| --- | --- |
| Virtual | Create the expensive real object lazily, on first use |
| Protection | Check permissions before forwarding |
| Caching | Return stored results for repeated requests |
| Remote | Represent an object in another process or service (RPC stubs) |
| Smart reference | Count references, log access, or lock around calls |

## Why it matters

These concerns are about *access*, not the real object's job. Putting permission checks or lazy loading into the real class violates Single Responsibility; putting them in every caller duplicates logic. A proxy keeps them in one substitutable wrapper, and clients don't need to change.

```python
from typing import Protocol

class ReportStore(Protocol):
    def get(self, report_id: str) -> str: ...
    def delete(self, report_id: str) -> None: ...

class S3ReportStore:
    def __init__(self) -> None:
        print("connecting to S3 (expensive)...")
        self._data = {"r1": "Q3 revenue: 4.2 Cr"}

    def get(self, report_id: str) -> str:
        return self._data[report_id]

    def delete(self, report_id: str) -> None:
        self._data.pop(report_id, None)

class GuardedLazyStore:
    """Virtual + protection proxy."""

    def __init__(self, role: str) -> None:
        self._role = role
        self._real: S3ReportStore | None = None

    def _target(self) -> S3ReportStore:
        if self._real is None:          # created only when first needed
            self._real = S3ReportStore()
        return self._real

    def get(self, report_id: str) -> str:
        return self._target().get(report_id)

    def delete(self, report_id: str) -> None:
        if self._role != "admin":
            raise PermissionError("only admins can delete reports")
        self._target().delete(report_id)

store: ReportStore = GuardedLazyStore(role="viewer")
print("proxy ready")             # no S3 connection yet
print(store.get("r1"))           # connects now
try:
    store.delete("r1")
except PermissionError as e:
    print(e)
```

## When to use / when not to

Use a proxy for lazy loading of heavy resources, access control, client-side caching, rate limiting, or remote access. Avoid it when a direct call is fine; proxies add indirection, and lazy creation can move latency spikes and failures to surprising places (the first request).

## Common mistakes

- Breaking the interface so the proxy isn't substitutable.
- Lazy initialisation without thread safety, creating the real object twice.
- Caching proxies without invalidation or size limits.
- Mixing proxy concerns (access) with decorator concerns (new features) until the wrapper does everything.

## In the interview

**Q: Proxy vs Decorator?**
They look the same structurally. A decorator adds behaviour the client asks for and is usually composed by the client; a proxy controls access to the real object and often manages its lifecycle.

**Q: Give a real-world proxy.**
ORM lazy-loaded relationships, gRPC client stubs (remote proxy), and CDN or API-gateway caches.

**Q: How would you use it in a rate limiter design?**
Wrap the real service in a proxy that consults the limiter before forwarding, so the service itself stays unaware of throttling.

## Key takeaways

- A proxy shares the real object's interface and controls access to it.
- Virtual, protection, caching, and remote are the main kinds.
- Keeps access concerns out of the real class and out of callers.
- Watch thread safety for lazy creation and invalidation for caches.
