Design a notification service that other systems call to send messages to users over email, SMS, and push, honouring user preferences, templates, and retries. The design tests your use of Strategy and Observer, async processing with queues, and reliability concerns like idempotency and rate limits.

## Requirements

**Functional**

- Producers (order service, auth service) call `send(user_id, event_type, data)`; the service decides channels and content.
- Channels: email, SMS, push (extensible to WhatsApp, in-app).
- Templates per event type and channel, with variable substitution and localisation.
- User preferences: opt-in/out per channel and category (marketing vs transactional); quiet hours.
- Priority: OTPs and security alerts bypass quiet hours and go first.
- Retries with backoff on provider failure; fall back to another provider or channel.
- Delivery status tracking.

**Non-functional**

- Producers get a fast acknowledgement; delivery is asynchronous.
- At-least-once delivery with deduplication (no double OTPs on retries).
- Per-user and per-provider rate limits.
- Provider outages must not lose notifications.

## Core entities

| Entity | Responsibility |
| --- | --- |
| `NotificationRequest` | Idempotency key, user, event type, data, priority |
| `Notification` | One message for one channel: rendered content, status, attempts |
| `Channel` (enum) | EMAIL, SMS, PUSH |
| `UserPreferences` | Channel opt-ins, categories, quiet hours, contact details |
| `TemplateEngine` | Renders templates per event, channel, locale |
| `ChannelSender` (interface) | Sends via a provider; `EmailSender`, `SmsSender`, `PushSender` |
| `ProviderAdapter` | Wraps a specific vendor (SES, Twilio, FCM) |
| `NotificationQueue` | Priority queues and worker pool |
| `NotificationService` | Facade: accept, fan out, enqueue |

## Class design

```python
import heapq
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum, IntEnum
from typing import Any, Protocol

class Channel(Enum):
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"

class Priority(IntEnum):
    CRITICAL = 0       # OTP, security
    TRANSACTIONAL = 1
    MARKETING = 2

class Status(Enum):
    QUEUED = "queued"
    SENT = "sent"
    FAILED = "failed"
    SKIPPED = "skipped"

@dataclass(frozen=True)
class NotificationRequest:
    idempotency_key: str
    user_id: str
    event_type: str
    data: dict[str, Any]
    priority: Priority = Priority.TRANSACTIONAL

@dataclass(order=True)
class Notification:
    priority: Priority
    notification_id: str = field(compare=False)
    user_id: str = field(compare=False)
    channel: Channel = field(compare=False)
    to: str = field(compare=False)
    body: str = field(compare=False)
    attempts: int = field(default=0, compare=False)
    status: Status = field(default=Status.QUEUED, compare=False)

class PreferenceStore(Protocol):
    def channels_for(self, user_id: str, event_type: str, priority: Priority) -> list[tuple[Channel, str]]: ...

class TemplateEngine(Protocol):
    def render(self, event_type: str, channel: Channel, data: dict[str, Any], locale: str) -> str: ...

class ChannelSender(ABC):
    @abstractmethod
    def send(self, n: Notification) -> bool: ...

class FailoverSender(ChannelSender):
    """Tries providers in order (e.g. Twilio, then a backup SMS vendor)."""

    def __init__(self, providers: list[ChannelSender]) -> None:
        self._providers = providers

    def send(self, n: Notification) -> bool:
        return any(p.send(n) for p in self._providers)

class NotificationService:
    MAX_ATTEMPTS = 5

    def __init__(self, prefs: PreferenceStore, templates: TemplateEngine,
                 senders: dict[Channel, ChannelSender], workers: int = 4) -> None:
        self._prefs, self._templates, self._senders = prefs, templates, senders
        self._heap: list[Notification] = []
        self._cv = threading.Condition()
        self._seen_keys: set[str] = set()        # idempotency (a TTL store in prod)

    def submit(self, req: NotificationRequest) -> list[str]: ...   # fan out + enqueue
    def _worker(self) -> None: ...                                 # pop, send, retry
    def _schedule_retry(self, n: Notification) -> None: ...        # backoff with jitter
```

## Key flows

1. **Submit**:
   1. If `idempotency_key` was seen, return the existing notification IDs (no duplicates).
   2. `channels = prefs.channels_for(user, event_type, priority)`: applies opt-outs, category rules, and quiet hours (critical bypasses them).
   3. For each channel, render the template and create a `Notification`.
   4. Push onto the priority queue; notify workers via the condition variable. Return IDs immediately.
2. **Worker loop**: wait for work, pop the highest-priority notification, check per-user rate limits, call `senders[channel].send(n)`.
3. **Success**: mark SENT, record provider message ID for delivery receipts.
4. **Failure**: increment attempts; if under the limit, re-enqueue after exponential backoff with jitter; otherwise mark FAILED and optionally trigger a fallback channel (SMS failed -> push).
5. **Delivery receipts**: provider webhooks update status (DELIVERED, BOUNCED); hard bounces update preferences to stop sending.

## Patterns used

- **Strategy**: one `ChannelSender` per channel; adding WhatsApp is a new sender plus templates.
- **Adapter**: each vendor SDK (SES, Twilio, FCM) adapted to `ChannelSender`.
- **Chain/failover (Decorator-like)**: `FailoverSender` wraps several providers behind one sender.
- **Observer**: producers publish domain events (`OrderShipped`); the notification service subscribes and maps them to notifications.
- **Producer-consumer**: priority queue plus worker pool decouples acceptance from delivery.
- **Template Method (optional)**: a base sender with `validate -> render -> deliver -> record` steps.

## Concurrency & edge cases

- Priority queue access guarded by a `Condition`; workers block when idle.
- **Idempotency** across retries and duplicate producer calls; store keys with a TTL.
- **Rate limits**: per user (no more than N marketing messages a day) and per provider (API quotas); throttled items are re-queued with delay.
- **Quiet hours** computed in the user's timezone; deferred, not dropped.
- **Provider outage**: circuit breaker per provider to fail fast and switch to backup.
- **Crash safety**: in production, the queue is durable (Kafka/SQS), and workers acknowledge only after sending.

## Follow-ups the interviewer may ask

**How do you avoid sending the same OTP twice?**
Idempotency key per request, checked before fan-out; providers also get a deduplication ID where supported.

**How do you prioritise OTPs over marketing blasts?**
Separate priority levels (or separate queues with dedicated workers) so a million-recipient campaign never delays an OTP.

**How would you support scheduled notifications?**
Store them with a `send_at`; a scheduler moves due items into the live queue. A delay queue (sorted by time) works in-process.

**How do you handle a user with three devices for push?**
Preferences return all device tokens; fan out one push per token and remove tokens the provider reports as invalid.

**How do you track analytics (open rates)?**
Tracking pixels and link redirects for email, provider receipts for SMS and push, all published as events to an analytics pipeline.
