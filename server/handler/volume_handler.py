"""Volume handlers - relative up/down/mute plus absolute set, via Hammerspoon."""

import asyncio

from common_helper import lua_snippets as lua
from common_helper.decorators import log_timing
from common_helper.hs_bridge import run_hs
from config.settings import settings


@log_timing("volume.up")
async def volume_up() -> None:
    await asyncio.to_thread(run_hs, lua.volume_up(settings.VOLUME_STEP))


@log_timing("volume.down")
async def volume_down() -> None:
    await asyncio.to_thread(run_hs, lua.volume_down(settings.VOLUME_STEP))


@log_timing("volume.mute")
async def volume_mute() -> None:
    await asyncio.to_thread(run_hs, lua.VOLUME_MUTE_TOGGLE)


@log_timing("volume.set")
async def volume_set(level: int) -> None:
    await asyncio.to_thread(run_hs, lua.volume_set(level))
