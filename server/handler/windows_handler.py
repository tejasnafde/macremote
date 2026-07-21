"""Window-grouped switcher handler - lists standard windows grouped by the
display they are on (covers two Firefox windows on different monitors, which
the app-level switcher cannot distinguish), and focuses a specific window.

Focus is nil-safe by design: a window can close between the phone's list
refresh and the tap, and that is a "gone" outcome for the app to toast, not
a 5xx."""

import asyncio
import json

from common_helper import lua_snippets as lua
from common_helper.decorators import log_timing
from common_helper.hs_bridge import HSError, run_hs


@log_timing("windows.list")
async def list_windows() -> dict:
    raw = await asyncio.to_thread(run_hs, lua.LIST_WINDOWS)
    try:
        windows = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HSError(f"hs returned non-JSON window list: {raw!r}") from exc
    # hs.json.encode({}) serializes an empty Lua table as an object, not an
    # array - treat anything non-list as "no windows".
    if not isinstance(windows, list):
        windows = []

    # Group by screen, preserving first-seen screen order.
    displays: list[dict] = []
    by_screen: dict[int, dict] = {}
    for win in windows:
        screen_id = win.get("screen_id") or 0
        display = by_screen.get(screen_id)
        if display is None:
            display = {"name": win.get("screen") or "", "id": screen_id, "windows": []}
            by_screen[screen_id] = display
            displays.append(display)
        display["windows"].append(
            {
                "id": win.get("id"),
                "app": win.get("app") or "",
                "bundle_id": win.get("bundle_id") or "",
                "title": win.get("title") or "",
                "active": bool(win.get("active")),
            }
        )

    # Within a display: the active window first, then by app name (then title
    # for a stable order between polls).
    for display in displays:
        display["windows"].sort(
            key=lambda w: (not w["active"], w["app"].lower(), w["title"].lower())
        )
    # The display holding the active window leads; the rest keep their order.
    displays.sort(key=lambda d: not any(w["active"] for w in d["windows"]))

    return {"displays": displays}


@log_timing("windows.focus")
async def focus_window(window_id: int) -> dict:
    result = await asyncio.to_thread(run_hs, lua.focus_window(window_id))
    if result == "gone":
        return {"ok": False, "gone": True}
    return {"ok": True}
