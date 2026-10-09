Design a logging library like a simplified version of Python's `logging` or Log4j: callers log messages at levels, and the framework filters, formats, and writes them to one or more destinations. It tests pattern fluency (Chain of Responsibility, Strategy, Singleton) and non-blocking I/O thinking.

## Requirements

**Functional**

- Log levels: DEBUG < INFO < WARN < ERROR < FATAL; each logger has a minimum level.
- `logger.info("msg", **context)` creates a record with timestamp, level, logger name, message, and context.
- Multiple sinks (appenders): console, file, remote HTTP endpoint; each sink can have its own level and formatter.
- Pluggable formatters: plain text, JSON.
- Named, hierarchical loggers (`app.payments` inherits config from `app`).
- Configuration at startup (code or dict).

**Non-functional**

- Logging must never crash the application, and should add minimal latency to the caller.
- Thread-safe: many threads log concurrently without interleaved lines.
- Ordering preserved per sink.
- Extensible: new sinks and formatters without modifying core classes.

## Core entities

| Entity | Responsibility |
| --- | --- |
| `Level` (enum) | Ordered severity values |
| `LogRecord` | Immutable event: time, level, logger name, message, context, thread |
| `Formatter` (interface) | `format(record) -> str`; `TextFormatter`, `JsonFormatter` |
| `Sink` (interface) | `emit(record)`; `ConsoleSink`, `FileSink`, `HttpSink` |
| `AsyncSink` | Decorator: queues records and writes them on a background thread |
| `Logger` | Name, level, sinks, parent; builds records and dispatches |
| `LogManager` | Registry of loggers by name; creates hierarchy; holds root |

## Class design

```python
import json
import queue
import threading
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Any

class Level(IntEnum):
    DEBUG = 10
    INFO = 20
    WARN = 30
    ERROR = 40
    FATAL = 50

@dataclass(frozen=True)
class LogRecord:
    level: Level
    logger: str
    message: str
    context: dict[str, Any] = field(default_factory=dict)
    ts: float = field(default_factory=time.time)
    thread: str = field(default_factory=lambda: threading.current_thread().name)

class Formatter(ABC):
    @abstractmethod
    def format(self, r: LogRecord) -> str: ...

class TextFormatter(Formatter):
    def format(self, r: LogRecord) -> str:
        return f"{r.ts:.3f} [{r.level.name}] {r.logger}: {r.message} {r.context or ''}"

class JsonFormatter(Formatter):
    def format(self, r: LogRecord) -> str:
        return json.dumps({"ts": r.ts, "level": r.level.name, "logger": r.logger,
                           "msg": r.message, **r.context})

class Sink(ABC):
    def __init__(self, formatter: Formatter, level: Level = Level.DEBUG) -> None:
        self.formatter, self.level = formatter, level

    def handle(self, r: LogRecord) -> None:
        if r.level >= self.level:
            self.emit(r)

    @abstractmethod
    def emit(self, r: LogRecord) -> None: ...

class ConsoleSink(Sink): ...
class FileSink(Sink): ...                 # holds a lock around writes; supports rotation

class AsyncSink(Sink):
    """Decorator: wraps any sink and writes on a background thread."""

    def __init__(self, inner: Sink, capacity: int = 10_000) -> None:
        super().__init__(inner.formatter, inner.level)
        self._inner = inner
        self._q: queue.Queue[LogRecord] = queue.Queue(maxsize=capacity)
        threading.Thread(target=self._drain, daemon=True).start()

    def emit(self, r: LogRecord) -> None:
        try:
            self._q.put_nowait(r)
        except queue.Full:
            pass                            # drop + count; never block the caller

    def _drain(self) -> None: ...

class Logger:
    def __init__(self, name: str, parent: "Logger | None" = None) -> None:
        self.name, self.parent = name, parent
        self.level: Level | None = None     # None = inherit from parent
        self.sinks: list[Sink] = []
        self.propagate = True

    def effective_level(self) -> Level: ...
    def log(self, level: Level, msg: str, **ctx: Any) -> None: ...
    def info(self, msg: str, **ctx: Any) -> None:
        self.log(Level.INFO, msg, **ctx)

class LogManager:
    _lock = threading.Lock()
    _loggers: dict[str, Logger] = {}
    root = Logger("root")

    @classmethod
    def get_logger(cls, name: str) -> Logger: ...   # creates parents as needed
```

## Key flows

1. **Get a logger**: `LogManager.get_logger("app.payments")` returns a cached logger or creates it, linking its parent (`app`, then `root`) under the manager's lock.
2. **Log a message**:
   1. `logger.log(level, msg, **ctx)`: if `level < effective_level()`, return immediately (cheap filter before creating a record).
   2. Build an immutable `LogRecord`.
   3. Walk up the chain: for the current logger, call `sink.handle(record)` for each sink; if `propagate` is true, move to the parent and repeat.
   4. Each sink filters by its own level, formats, and emits; exceptions inside sinks are caught and reported to stderr, never raised to the caller.
3. **Async emission**: `AsyncSink.emit` enqueues; the background thread drains and calls the inner sink. On shutdown, flush the queue.

## Patterns used

- **Chain of Responsibility**: records travel from child logger to parents; each level's sinks may handle them.
- **Strategy**: `Formatter` implementations; sinks are configured with one.
- **Decorator**: `AsyncSink` wraps any sink to add asynchrony (also possible: `BufferedSink`, `SamplingSink`).
- **Singleton / registry**: `LogManager` ensures one logger instance per name across the process.
- **Observer (loosely)**: a logger fans each record out to all attached sinks.

## Concurrency & edge cases

- **Interleaved lines**: each sink serialises writes with its own lock (or a single writer thread via `AsyncSink`).
- **Slow sinks** (network): never call them inline; use `AsyncSink` with a bounded queue and a drop policy (drop oldest, drop DEBUG first, or block for FATAL only).
- **Sink failures**: catch everything in `handle`; a broken disk must not take down request handling.
- **Shutdown**: register an `atexit` flush so queued records aren't lost.
- **Expensive messages**: support lazy formatting (`logger.debug("x=%s", big_obj)`) so arguments are only stringified if the level is enabled.
- **Log injection**: escape newlines in user-provided messages for text formats.

## Follow-ups the interviewer may ask

**How do you avoid blocking the application thread?**
An async sink with a bounded queue and a background writer. If the queue is full, apply a drop policy and increment a dropped-records counter rather than blocking.

**How would you add log rotation?**
Make `FileSink` check size or time before each write and roll the file (rename and reopen) under its lock; or implement a `RotatingFileSink` subclass.

**How do you change log levels at runtime?**
Expose `set_level` on loggers through an admin endpoint or config watcher; since effective level is resolved through the parent chain, changing `app` affects all children that inherit.

**How would you add a correlation/request ID to every line?**
Store it in a `contextvars.ContextVar` set by request middleware; the logger reads it when building the record, so callers don't pass it explicitly.

**How would you ship logs to a central system?**
An `HttpSink` or `KafkaSink` that batches records and retries with backoff, wrapped in `AsyncSink`; on persistent failure, spill to a local file.
