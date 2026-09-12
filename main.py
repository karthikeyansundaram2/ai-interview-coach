"""Fallback entry point for hosts started from the repo root (Root Directory not set to `backend`).

`uvicorn main:app` from here loads the same FastAPI app as `backend/main.py`.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

from app.main import app  # noqa: E402

__all__ = ["app"]
