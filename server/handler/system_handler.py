"""System handlers - lock screen / sleep the Mac, via Hammerspoon."""

import asyncio

from common_helper import lua_snippets as lua
from common_helper.decorators import log_timing
from common_helper.hs_bridge import run_hs


@log_timing("system.lock")
async def lock() -> None:
    await asyncio.to_thread(run_hs, lua.LOCK)


@log_timing("system.sleep")
async def sleep() -> None:
    await asyncio.to_thread(run_hs, lua.SLEEP)


@log_timing("system.banish_cursor")
async def banish_cursor() -> None:
    await asyncio.to_thread(run_hs, lua.CURSOR_BANISH)


@log_timing("system.blackout")
async def blackout() -> None:
    """Volume 0 + brightness 0 on every display; the Mac stays awake."""
    from common_helper.ddc_bridge import DDCError, run_m1ddc
    from handler.displays_handler import _external_displays

    await asyncio.to_thread(run_hs, lua.BLACKOUT)
    for d in await _external_displays():
        try:
            await asyncio.to_thread(
                run_m1ddc, ["display", str(d["index"]), "set", "luminance", "0"]
            )
        except DDCError:
            pass  # best effort: a monitor without DDC keeps its brightness
