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


@router.post("/blackout")
async def blackout() -> dict:
    """Volume 0 and brightness 0 on every display; the Mac stays awake."""
    await system_handler.blackout()
    return {"ok": True}


@router.post("/screens-on")
async def screens_on() -> dict:
    """Undo blackout: restore volume and brightness to pre-blackout levels."""
    await system_handler.screens_on()
    return {"ok": True}


@router.post("/banish-cursor")
async def banish_cursor() -> dict:
    """Park the pointer in the corner: fixes the stuck cursor over fullscreen video."""
    await system_handler.banish_cursor()
    return {"ok": True}
