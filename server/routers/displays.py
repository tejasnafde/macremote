from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from common_helper.auth import require_bearer_token
from common_helper.ddc_bridge import DDCError
from handler import brightness_handler, displays_handler

router = APIRouter(
    prefix="/displays",
    tags=["displays"],
    dependencies=[Depends(require_bearer_token)],
)


class MethodBody(BaseModel):
    method: Literal["gamma", "ddc"]


@router.get("")
async def get_displays() -> dict:
    return await displays_handler.get_displays()


@router.put("/{display_id}/method")
async def set_method(display_id: str, body: MethodBody) -> dict:
    """Choose how an external display dims: gamma (default, universal) or ddc
    (true backlight, only for monitors that honor it)."""
    try:
        name = await displays_handler.resolve_external_name(display_id)
    except (DDCError, KeyError):
        raise HTTPException(status_code=404, detail=f"no external display {display_id!r}")
    brightness_handler.set_method(name, body.method)
    return {"ok": True, "display": display_id, "method": body.method}
