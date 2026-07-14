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


@log_timing("media.seek")
async def seek(delta_seconds: int) -> str:
    """Returns which mechanism handled the seek: spotify, music, or keys."""
    return await asyncio.to_thread(run_hs, lua.media_seek(delta_seconds))
