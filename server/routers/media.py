from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from common_helper.auth import require_bearer_token
from handler import media_handler


class SeekBody(BaseModel):
    seconds: int = Field(..., ge=-60, le=60)

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


@router.post("/seek")
async def seek(body: SeekBody) -> dict:
    """Seek by +/- seconds. Exact for Spotify/Music, arrow-key fallback otherwise."""
    if body.seconds == 0:
        return {"ok": True, "via": "noop"}
    via = await media_handler.seek(body.seconds)
    return {"ok": True, "via": via}
