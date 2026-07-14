"""Brightness handlers - relative up/down via Hammerspoon."""

import asyncio

from common_helper import lua_snippets as lua
from common_helper.decorators import log_timing
from common_helper.hs_bridge import run_hs
from config.settings import settings


@log_timing("brightness.up")
async def brightness_up() -> None:
    await asyncio.to_thread(run_hs, lua.brightness_up(settings.VOLUME_STEP))


@log_timing("brightness.down")
async def brightness_down() -> None:
    await asyncio.to_thread(run_hs, lua.brightness_down(settings.VOLUME_STEP))
