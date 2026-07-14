from fastapi import APIRouter, Depends

from common_helper.auth import require_bearer_token
from handler import system_handler

router = APIRouter(
    prefix="/system",
    tags=["system"],
    dependencies=[Depends(require_bearer_token)],
)


@router.post("/lock")
async def lock() -> dict:
    await system_handler.lock()
    return {"ok": True}


@router.post("/sleep")
async def sleep() -> dict:
    await system_handler.sleep()
    return {"ok": True}


@router.post("/banish-cursor")
async def banish_cursor() -> dict:
    """Park the pointer in the corner: fixes the stuck cursor over fullscreen video."""
    await system_handler.banish_cursor()
    return {"ok": True}
