"""Bearer-token auth dependency. Static token in `.env`; Tailscale is the outer
wall, this is defense-in-depth. Applied to every router except /health and /version."""

import secrets

from fastapi import Header, HTTPException, status

from config.settings import settings

MIN_TOKEN_LENGTH = 32
PLACEHOLDER_TOKENS = {
    "change-me-to-a-long-random-token",
    "change-me",
    "changeme",
    "replace-me",
}


def validate_api_token(token: str) -> None:
    """Refuse to run with a token that can be guessed or matched by empty input."""
    clean = token.strip()
    if len(clean) < MIN_TOKEN_LENGTH or clean.lower() in PLACEHOLDER_TOKENS:
        raise RuntimeError(
            "API_TOKEN must be a non-placeholder random token of at least "
            f"{MIN_TOKEN_LENGTH} characters"
        )


async def require_bearer_token(authorization: str | None = Header(default=None)) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing bearer token")

    token = authorization.removeprefix("Bearer ").strip()
    configured = settings.API_TOKEN.strip()
    if not configured or not secrets.compare_digest(token, configured):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")
