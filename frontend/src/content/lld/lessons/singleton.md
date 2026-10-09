A Singleton guarantees a class has exactly one instance and gives everyone a way to reach it. It's the most famous pattern and the one interviewers are most likely to push back on, so know both how and why not.

## The idea

A country has one official time standard. Everyone checks the same clock; it would be chaos if each office kept its own. A Singleton models that kind of genuinely unique, shared resource: a configuration registry, a connection pool, a logger's root.

## Why it exists, and why to be careful

The benefit is controlled access to one shared resource. The costs are significant:

- It's **global state** with a nicer name; any code can reach it, which hides dependencies.
- It makes **testing harder**, since tests share one instance unless you reset it.
- It **couples** callers to a concrete class, working against Dependency Inversion.
- Lazy creation needs **thread safety**.

In Python, the most idiomatic singleton is a **module-level instance**: modules are imported once, so `config = Config()` at module scope is already unique. When you need a class-enforced singleton (common in interview code), use a lock with double-checked creation.

```python
import threading
from typing import Any

class ConfigRegistry:
    _instance: "ConfigRegistry | None" = None
    _lock = threading.Lock()

    def __new__(cls) -> "ConfigRegistry":
        if cls._instance is None:                 # fast path, no lock
            with cls._lock:
                if cls._instance is None:         # re-check under lock
                    inst = super().__new__(cls)
                    inst._values = {}
                    inst._values_lock = threading.Lock()
                    cls._instance = inst
        return cls._instance

    def set(self, key: str, value: Any) -> None:
        with self._values_lock:
            self._values[key] = value

    def get(self, key: str, default: Any = None) -> Any:
        return self._values.get(key, default)

a = ConfigRegistry()
b = ConfigRegistry()
a.set("max_spots", 500)
print(a is b, b.get("max_spots"))  # True 500

# Often better: create one instance and inject it.
class ParkingService:
    def __init__(self, config: ConfigRegistry) -> None:
        self._config = config
```

The second check inside the lock prevents two threads that both passed the first check from creating two instances.

## When to use / when not to

Use it for truly process-wide resources with no meaningful second instance: a logging root, a metrics registry, a hardware handle. Even then, prefer creating one instance in the composition root and **injecting** it; you get the uniqueness without hidden global access. Don't use it for things that "happen to have one instance today", like a `ParkingLot`; tomorrow there will be two lots and your design will fight you.

## Common mistakes

- Making the main domain object (ParkingLot, Elevator controller) a singleton "because there's only one".
- Forgetting thread safety on lazy initialisation.
- Overriding `__init__` without guarding it, so state is reset on every `ConfigRegistry()` call.
- Using singletons as a back door to avoid passing dependencies.

## In the interview

**Q: How do you make a singleton thread-safe in Python?**
Double-checked locking around instance creation in `__new__`, or simply create the instance at module import time, which Python guarantees happens once.

**Q: Why is Singleton considered an anti-pattern?**
It's hidden global state: it obscures dependencies, couples callers to a concrete class, and makes tests interfere with each other. Injecting a single instance gives the same benefit without those costs.

**Q: Should the ParkingLot be a singleton?**
I'd avoid it. One instance per deployment is a wiring decision, not a class property, and supporting multiple lots later becomes trivial if I inject it.

## Key takeaways

- Singleton = one instance + global access point.
- In Python, a module-level instance is the simplest singleton.
- Lazy class-based singletons need double-checked locking.
- Prefer "single instance, injected" over "Singleton class, globally fetched".
