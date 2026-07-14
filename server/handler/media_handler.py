"""Media key handlers - shell out to Hammerspoon for play/pause/next/previous."""

import asyncio

from common_helper import lua_snippets as lua
from common_helper.decorators import log_timing
from common_helper.hs_bridge import run_hs


@log_timing("media.playpause")
async def playpause() -> None:
    await asyncio.to_thread(run_hs, lua.MEDIA_PLAYPAUSE)


@log_timing("media.next")
async def next_track() -> None:
    await asyncio.to_thread(run_hs, lua.MEDIA_NEXT)


@log_timing("media.previous")
async def previous_track() -> None:
    await asyncio.to_thread(run_hs, lua.MEDIA_PREVIOUS)
