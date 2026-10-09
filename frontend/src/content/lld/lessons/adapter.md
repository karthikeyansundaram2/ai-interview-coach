Adapter wraps a class whose interface doesn't match what your code expects and translates calls between the two. It lets you integrate third-party or legacy code without letting its awkward shape leak into your design.

## The idea

A travel plug adapter lets your Indian charger fit a UK socket. Neither the charger nor the socket changes; the adapter sits between them and converts one shape to the other. In software, the "socket" is the interface your domain defines, and the "charger" is some library or legacy system with its own conventions.

```text
 Client ──> <<interface>> SmsSender ◁- - - SmsAdapter ──> VendorSdk
                                         (translates)      (incompatible API)
```

## Why it matters

External APIs come with their own naming, units, error styles, and data formats. If your code calls them directly, those details spread everywhere, and switching vendors means editing every call site. An adapter confines the translation to one class, keeps your domain interface clean, and makes the vendor swappable (Dependency Inversion in action).

```python
from dataclasses import dataclass
from typing import Protocol

class SmsSender(Protocol):
    def send(self, phone: str, text: str) -> bool: ...

# Third-party SDK we can't change: different names, units, and error style.
class AcmeSmsClient:
    def dispatch_message(self, payload: dict) -> dict:
        if not payload["msisdn"].startswith("91"):
            return {"status": "ERR", "code": 400}
        return {"status": "QUEUED", "id": "acme-881"}

class AcmeSmsAdapter:
    """Adapts AcmeSmsClient to our SmsSender interface."""

    def __init__(self, client: AcmeSmsClient, sender_id: str) -> None:
        self._client = client
        self._sender_id = sender_id

    def send(self, phone: str, text: str) -> bool:
        payload = {
            "msisdn": phone.removeprefix("+"),
            "body": text[:160],
            "from": self._sender_id,
        }
        response = self._client.dispatch_message(payload)
        return response.get("status") == "QUEUED"

@dataclass
class OtpService:
    sms: SmsSender

    def send_otp(self, phone: str, code: str) -> bool:
        return self.sms.send(phone, f"Your OTP is {code}")

svc = OtpService(AcmeSmsAdapter(AcmeSmsClient(), "KAIVON"))
print(svc.send_otp("+919876543210", "4821"))  # True
```

## When to use / when not to

Use an adapter whenever you integrate something you don't control: payment gateways, SMS providers, legacy services, a library returning a different data model. Also useful when unifying several providers behind one interface. Don't use it to paper over your *own* code's poor interface; just fix the interface.

## Common mistakes

- Leaking vendor types through the adapter (returning the raw `dict` response).
- Putting business logic into the adapter; it should only translate.
- Letting vendor exceptions escape instead of mapping them to domain errors.
- Confusing Adapter with Facade: an adapter changes an interface's *shape*; a facade *simplifies* a whole subsystem.

## In the interview

**Q: Adapter vs Facade vs Decorator?**
Adapter converts one interface into another; Facade provides a simpler front to many classes; Decorator keeps the same interface and adds behaviour.

**Q: How does Adapter help with vendor lock-in?**
Domain code depends on our interface. Switching vendors means writing a new adapter, with no changes to business logic.

**Q: Where's the error handling?**
In the adapter: map vendor error codes and exceptions into our own exception types so callers see a consistent contract.

## Key takeaways

- Adapter translates an incompatible interface into the one you own.
- Keep it thin: translation only, no business rules.
- Map vendor errors and types into domain ones.
- It's the standard way to isolate third-party dependencies.
