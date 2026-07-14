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
