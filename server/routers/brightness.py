from fastapi import APIRouter, Depends

from common_helper.auth import require_bearer_token
from handler import brightness_handler

router = APIRouter(
    prefix="/brightness",
    tags=["brightness"],
    dependencies=[Depends(require_bearer_token)],
)


@router.post("/up")
async def brightness_up() -> dict:
    await brightness_handler.brightness_up()
    return {"ok": True}


@router.post("/down")
async def brightness_down() -> dict:
    await brightness_handler.brightness_down()
    return {"ok": True}
