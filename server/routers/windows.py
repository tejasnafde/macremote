"""Window-grouped switcher: list standard windows grouped by display and
focus one by window id. Complements /apps (kept for the widget and app-level
back-compat), which cannot tell two windows of the same app apart."""

from fastapi import APIRouter, Depends

from common_helper.auth import require_bearer_token
from handler import windows_handler

router = APIRouter(
    prefix="/windows",
    tags=["windows"],
    dependencies=[Depends(require_bearer_token)],
)


@router.get("")
async def list_windows() -> dict:
    return await windows_handler.list_windows()


@router.post("/{window_id}/focus")
async def focus_window(window_id: int) -> dict:
    return await windows_handler.focus_window(window_id)
