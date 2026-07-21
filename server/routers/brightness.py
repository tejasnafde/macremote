from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from common_helper.auth import require_bearer_token
from common_helper.ddc_bridge import DDCError
from handler import brightness_handler

router = APIRouter(
    prefix="/brightness",
    tags=["brightness"],
    dependencies=[Depends(require_bearer_token)],
)


class BrightnessLevel(BaseModel):
    level: int = Field(ge=0, le=100)
    display: str = "builtin"


# An external monitor with neither DDC nor gamma control is an expected,
# per-monitor condition, not a server fault: return a clean "unsupported" so
# the app can toast it, instead of a 502 that fires a Discord alert on every
# tap. Built-in failures still bubble up to the global HSError handler as real
# errors. External ops report which path did the work ("ddc" or "gamma");
# built-in ops have no via.
async def _guard(coro) -> dict:
    try:
        via = await coro
    except DDCError:
        return {"ok": False, "display_unsupported": True}
    result = {"ok": True}
    if via is not None:
        result["via"] = via
    return result


@router.post("/up")
async def brightness_up(display: str = "builtin") -> dict:
    return await _guard(brightness_handler.brightness_up(display))


@router.post("/down")
async def brightness_down(display: str = "builtin") -> dict:
    return await _guard(brightness_handler.brightness_down(display))


@router.put("")
async def brightness_set(body: BrightnessLevel) -> dict:
    result = await _guard(brightness_handler.brightness_set(body.level, body.display))
    return {**result, "level": body.level, "display": body.display}
