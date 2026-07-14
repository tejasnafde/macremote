"""Bearer-token auth dependency. Static token in `.env`; Tailscale is the outer
wall, this is defense-in-depth. Applied to every router except /health and /version."""

import secrets

from fastapi import Header, HTTPException, status

from config.settings import settings


async def require_bearer_token(authorization: str | None = Header(default=None)) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing bearer token")

    token = authorization.removeprefix("Bearer ").strip()
    if not secrets.compare_digest(token, settings.API_TOKEN):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")
