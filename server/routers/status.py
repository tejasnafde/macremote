from fastapi import APIRouter, Depends

from common_helper.auth import require_bearer_token
from handler import status_handler

router = APIRouter(
    prefix="/status",
    tags=["status"],
    dependencies=[Depends(require_bearer_token)],
)


@router.get("")
async def get_status() -> dict:
    return await status_handler.get_status()
