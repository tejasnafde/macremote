"""Reads the single-line VERSION file at the server package root."""

from functools import lru_cache
from pathlib import Path

VERSION_FILE = Path(__file__).resolve().parent.parent / "VERSION"


@lru_cache(maxsize=1)
def get_version() -> str:
    return VERSION_FILE.read_text().strip()
