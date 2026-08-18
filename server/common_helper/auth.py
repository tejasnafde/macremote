"""Bearer-token auth dependency. Static token in `.env`; Tailscale is the outer
wall, this is defense-in-depth. Applied to every router except /health and /version."""

import secrets

from fastapi import Header, HTTPException, status

from config.settings import settings

PLACEHOLDER_TOKENS = {
    "change-me-to-a-long-random-token",
    "change-me",
    "changeme",
    "replace-me",
}


def validate_api_token(token: str) -> None:
    """Reject credentials that cannot safely protect privileged Mac controls."""
    clean = token.strip()
    if not clean or clean.lower() in PLACEHOLDER_TOKENS:
        raise RuntimeError("API_TOKEN must be set to a non-placeholder random token")
    if len(clean) < 32:
        raise RuntimeError("API_TOKEN must contain at least 32 characters")


async def require_bearer_token(authorization: str | None = Header(default=None)) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing bearer token")

    token = authorization.removeprefix("Bearer ").strip()
    configured = settings.API_TOKEN.strip()
    if not configured or not secrets.compare_digest(token, configured):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")
