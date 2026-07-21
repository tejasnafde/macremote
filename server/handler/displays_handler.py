"""Displays handler - enumerates the built-in panel (via Hammerspoon) and any
DDC/CI-capable external monitors (via m1ddc), with a best-effort brightness
reading for each. Probing never raises here: a missing m1ddc binary, no
external display connected, or a cable/monitor that doesn't support DDC/CI
all degrade to brightness: null (or an empty external list), never a 5xx."""

import asyncio

from common_helper import lua_snippets as lua
from common_helper.decorators import log_timing
from common_helper.ddc_bridge import DDCError, parse_display_list, run_m1ddc
from common_helper.hs_bridge import HSError, run_hs
from handler import brightness_handler


async def _builtin_brightness() -> int | None:
    try:
        raw = await asyncio.to_thread(run_hs, lua.BRIGHTNESS_GET)
    except HSError:
        return None
    if raw == "null":
        return None
    try:
        return int(raw)
    except ValueError:
        return None


async def _external_displays() -> list[dict]:
    try:
        raw = await asyncio.to_thread(run_m1ddc, ["display", "list"])
    except DDCError:
        return []
    # m1ddc lists a phantom "(null)" entry on some Macs; controlling it always
    # fails, so hide it.
    return [d for d in parse_display_list(raw) if d.get("name") and d["name"] != "(null)"]


async def _external_brightness(index: int) -> int | None:
    try:
        raw = await asyncio.to_thread(
            run_m1ddc, ["display", str(index), "get", "luminance"]
        )
        return int(raw.strip())
    except (DDCError, ValueError):
        return None


@log_timing("displays.get")
async def get_displays() -> dict:
    displays = [
        {
            "id": "builtin",
            "name": "Built-in",
            "builtin": True,
            "brightness": await _builtin_brightness(),
        }
    ]

    for disp in await _external_displays():
        displays.append(
            {
                "id": str(disp["index"]),
                "name": disp["name"],
                "builtin": False,
                "brightness": await _external_brightness(disp["index"]),
                # Gamma-dimming fallback level (100 = undimmed) so the app can
                # show the effective dim state when DDC is unavailable.
                "gamma_level": brightness_handler.get_gamma_level(disp["name"]),
            }
        )

    return {"displays": displays}
