from fastapi import APIRouter, Depends

from common_helper.auth import require_bearer_token
from handler import displays_handler

router = APIRouter(
    prefix="/displays",
    tags=["displays"],
    dependencies=[Depends(require_bearer_token)],
)


@router.get("")
async def get_displays() -> dict:
    return await displays_handler.get_displays()
