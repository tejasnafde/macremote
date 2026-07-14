from fastapi import APIRouter, Depends

from common_helper.auth import require_bearer_token
from handler import media_handler

router = APIRouter(
    prefix="/media",
    tags=["media"],
    dependencies=[Depends(require_bearer_token)],
)


@router.post("/playpause")
async def playpause() -> dict:
    await media_handler.playpause()
    return {"ok": True}


@router.post("/next")
async def next_track() -> dict:
    await media_handler.next_track()
    return {"ok": True}


@router.post("/previous")
async def previous_track() -> dict:
    await media_handler.previous_track()
    return {"ok": True}
