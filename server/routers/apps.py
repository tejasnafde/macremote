"""App switcher: list running foreground apps and bring one to the front."""

import asyncio
import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from common_helper import lua_snippets as lua
from common_helper.auth import require_bearer_token
from common_helper.decorators import log_timing
from common_helper.hs_bridge import HSError, run_hs

router = APIRouter(
    prefix="/apps",
    tags=["apps"],
    dependencies=[Depends(require_bearer_token)],
)


class FocusBody(BaseModel):
    bundle_id: str


@router.get("")
@log_timing("apps.list")
async def list_apps() -> dict:
    raw = await asyncio.to_thread(run_hs, lua.LIST_APPS)
    try:
        apps = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HSError(f"hs returned non-JSON app list: {raw!r}") from exc
    # Stable, human-friendly order: frontmost first, then alphabetical.
    apps.sort(key=lambda a: (not a.get("active"), a.get("name", "").lower()))
    return {"apps": apps}


@router.post("/focus")
@log_timing("apps.focus")
async def focus_app(body: FocusBody) -> dict:
    await asyncio.to_thread(run_hs, lua.focus_app(body.bundle_id))
    return {"ok": True}
