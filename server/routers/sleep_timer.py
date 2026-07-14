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


@router.post("")
async def set_sleep_timer(body: SleepTimerRequest) -> dict:
    sleep_timer_service.start(body.minutes)
    return {"ok": True, "minutes": body.minutes}


@router.delete("")
async def cancel_sleep_timer() -> dict:
    cancelled = sleep_timer_service.cancel()
    return {"ok": True, "cancelled": cancelled}
