"""Status handler - now-playing, volume, brightness, battery, sleep-timer countdown."""

import asyncio
import json

from common_helper import lua_snippets as lua
from common_helper.decorators import log_timing
from common_helper.hs_bridge import HSError, run_hs
from handler.sleep_timer_handler import sleep_timer_service


@log_timing("status.get")
async def get_status() -> dict:
    raw = await asyncio.to_thread(run_hs, lua.STATUS)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HSError(f"hs returned non-JSON status: {raw!r}") from exc

    data["sleep_timer_remaining_seconds"] = sleep_timer_service.remaining_seconds()
    return data
