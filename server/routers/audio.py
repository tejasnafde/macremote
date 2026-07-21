"""Per-app system volume (Background Music). Degrades to available: false
when BGM is not installed or not running - never a 5xx."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from common_helper.auth import require_bearer_token
from handler import audio_apps_handler

router = APIRouter(
    prefix="/audio",
    tags=["audio"],
    dependencies=[Depends(require_bearer_token)],
)


class AppVolumeBody(BaseModel):
    name: str
    volume: int = Field(ge=0, le=100)


@router.get("/apps")
async def get_audio_apps() -> dict:
    return await audio_apps_handler.get_audio_apps()


@router.put("/apps")
async def set_audio_app_volume(body: AppVolumeBody) -> dict:
    return await audio_apps_handler.set_audio_app_volume(body.name, body.volume)
