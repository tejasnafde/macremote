from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from common_helper.auth import require_bearer_token
from handler.sleep_timer_handler import sleep_timer_service

router = APIRouter(
    prefix="/sleep-timer",
    tags=["sleep-timer"],
    dependencies=[Depends(require_bearer_token)],
)


class SleepTimerRequest(BaseModel):
    minutes: int = Field(ge=1, le=480)
    mode: Literal["sleep", "blackout"] = "sleep"


@router.post("")
async def set_sleep_timer(body: SleepTimerRequest) -> dict:
    """Arming while a timer runs replaces it, so re-arming IS editing."""
    sleep_timer_service.start(body.minutes, body.mode)
    return {"ok": True, "minutes": body.minutes, "mode": body.mode}


@router.delete("")
async def cancel_sleep_timer() -> dict:
    cancelled = sleep_timer_service.cancel()
    return {"ok": True, "cancelled": cancelled}
