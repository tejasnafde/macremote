"""Per-app system volume via the Background Music virtual audio driver.
Everything is feature-detected: BGM missing or not running answers
{"available": false} rather than erroring, because installing it is an
optional, admin-password user step."""

import asyncio

from common_helper import bgm_bridge
from common_helper.decorators import log_timing


@log_timing("audio_apps.list")
async def get_audio_apps() -> dict:
    if not await asyncio.to_thread(bgm_bridge.is_running):
        return {"available": False, "apps": []}
    apps = await asyncio.to_thread(bgm_bridge.list_audio_apps)
    if apps is None:
        return {"available": False, "apps": []}
    return {"available": True, "apps": apps}


@log_timing("audio_apps.set_volume")
async def set_audio_app_volume(name: str, volume: int) -> dict:
    if not await asyncio.to_thread(bgm_bridge.is_running):
        return {"ok": False, "available": False}
    if not await asyncio.to_thread(bgm_bridge.set_app_volume, name, volume):
        return {"ok": False, "available": False}
    return {"ok": True}
