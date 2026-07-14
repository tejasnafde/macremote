"""Unauthenticated endpoints: /health and /version."""

from fastapi import APIRouter

from common_helper.version import get_version

router = APIRouter(tags=["meta"])


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/version")
async def version() -> dict:
    return {"version": get_version()}
