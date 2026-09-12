"""Entry-point shim so `uvicorn main:app` works (e.g. Render's start command) as well as `uvicorn app.main:app`."""

from app.main import app

__all__ = ["app"]
