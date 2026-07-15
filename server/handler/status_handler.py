"""Status handler - now-playing, volume, brightness, battery, sleep-timer countdown."""

import asyncio
import json

from common_helper import lua_snippets as lua
from common_helper.decorators import log_timing
from common_helper.hs_bridge import HSError, run_hs
from handler import browser_sessions
from handler.sleep_timer_handler import sleep_timer_service


@log_timing("status.get")
async def get_status() -> dict:
    raw = await asyncio.to_thread(run_hs, lua.STATUS)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HSError(f"hs returned non-JSON status: {raw!r}") from exc

    # Canonical wire shape (shared with the Android app):
    # now_playing: {app,title,artist,state}|null ; sleep_timer: {remaining_seconds}|null
    data["now_playing"] = data.pop("nowplaying", None)
    remaining = sleep_timer_service.remaining_seconds()
    data["sleep_timer"] = (
        {"remaining_seconds": remaining, "mode": sleep_timer_service.mode()}
        if remaining is not None
        else None
    )
    data["browser_tabs"] = [
        {
            "tab_id": tab["tab_id"],
            "browser": tab["browser"],
            "title": tab["title"],
            "playing": tab["playing"],
            "audible": tab["audible"],
        }
        for tab in browser_sessions.registry.list_tabs()
    ]
    return data
