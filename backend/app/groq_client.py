"""Thin wrapper around the Groq SDK with friendly error translation."""

import logging

from groq import (
    APIConnectionError,
    APIStatusError,
    AuthenticationError,
    Groq,
    RateLimitError,
)

from app.config import settings

logger = logging.getLogger("interview_coach")

PLACEHOLDER_KEY = "your_groq_api_key_here"


class AIError(Exception):
    """Raised when the AI provider cannot fulfil a request. `status` is the HTTP code to return."""

    def __init__(self, detail: str, status: int = 502):
        super().__init__(detail)
        self.detail = detail
        self.status = status


def key_configured() -> bool:
    return bool(settings.groq_api_key) and settings.groq_api_key != PLACEHOLDER_KEY


_client: Groq | None = None


def get_client() -> Groq:
    global _client
    if not key_configured():
        raise AIError(
            "The Groq API key is not configured. Add GROQ_API_KEY to backend/.env and restart the server.",
            status=503,
        )
    if _client is None:
        _client = Groq(api_key=settings.groq_api_key, timeout=45.0, max_retries=1)
    return _client


def chat(messages: list[dict], *, temperature: float, json_mode: bool = False, max_tokens: int = 1024) -> str:
    """Send a chat completion request and return the assistant text."""
    client = get_client()
    kwargs: dict = {
        "model": settings.groq_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    if settings.groq_model.startswith("openai/gpt-oss"):
        # Reasoning models spend tokens thinking before answering; keep it quick.
        kwargs["reasoning_effort"] = "low"

    try:
        try:
            completion = client.chat.completions.create(**kwargs)
        except APIStatusError as e:
            # Groq's JSON mode occasionally fails to produce a valid document; one retry usually fixes it.
            if json_mode and getattr(e, "code", None) == "json_validate_failed" or "json_validate_failed" in str(e):
                logger.warning("Groq JSON generation failed; retrying once")
                kwargs["max_tokens"] = max_tokens * 2
                completion = client.chat.completions.create(**kwargs)
            else:
                raise
    except AuthenticationError:
        raise AIError("Groq rejected the API key. Check GROQ_API_KEY in backend/.env.", status=503)
    except RateLimitError:
        raise AIError("The AI provider is rate-limiting us. Please wait a moment and try again.", status=429)
    except APIConnectionError:
        raise AIError("Could not reach the AI provider. Check your internet connection and try again.", status=502)
    except APIStatusError as e:
        logger.error("Groq API error %s: %s", e.status_code, e.message)
        raise AIError("The AI provider returned an error. Please try again.", status=502)

    content = completion.choices[0].message.content if completion.choices else None
    if not content or not content.strip():
        raise AIError("The AI returned an empty response. Please try again.", status=502)
    return content.strip()
