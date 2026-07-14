from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from common_helper.auth import require_bearer_token
from handler import brightness_handler

router = APIRouter(
    prefix="/brightness",
    tags=["brightness"],
    dependencies=[Depends(require_bearer_token)],
)


class BrightnessLevel(BaseModel):
    level: int = Field(ge=0, le=100)
    display: str = "builtin"


@router.post("/up")
async def brightness_up(display: str = "builtin") -> dict:
    await brightness_handler.brightness_up(display)
    return {"ok": True}


@router.post("/down")
async def brightness_down(display: str = "builtin") -> dict:
    await brightness_handler.brightness_down(display)
    return {"ok": True}


@router.put("")
async def brightness_set(body: BrightnessLevel) -> dict:
    await brightness_handler.brightness_set(body.level, body.display)
    return {"ok": True, "level": body.level, "display": body.display}
