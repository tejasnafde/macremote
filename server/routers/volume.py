from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from common_helper.auth import require_bearer_token
from handler import volume_handler

router = APIRouter(
    prefix="/volume",
    tags=["volume"],
    dependencies=[Depends(require_bearer_token)],
)


class VolumeLevel(BaseModel):
    level: int = Field(ge=0, le=100)


@router.post("/up")
async def volume_up() -> dict:
    await volume_handler.volume_up()
    return {"ok": True}


@router.post("/down")
async def volume_down() -> dict:
    await volume_handler.volume_down()
    return {"ok": True}


@router.post("/mute")
async def volume_mute() -> dict:
    await volume_handler.volume_mute()
    return {"ok": True}


@router.put("")
async def volume_set(body: VolumeLevel) -> dict:
    await volume_handler.volume_set(body.level)
    return {"ok": True, "level": body.level}
