"""Brightness handlers - relative up/down and absolute set, for the built-in
panel (via Hammerspoon's hs.brightness) or an external DDC/CI display (via
m1ddc). `display` is "builtin" (default) or an external display id, which is
the index m1ddc reports in `display list` (e.g. "1")."""

import asyncio

from common_helper import lua_snippets as lua
from common_helper.ddc_bridge import run_m1ddc
from common_helper.decorators import log_timing
from common_helper.hs_bridge import run_hs
from config.settings import settings

BUILTIN = "builtin"


def _clamp(level: int) -> int:
    return max(0, min(100, level))


async def _external_get_luminance(display: str) -> int:
    raw = await asyncio.to_thread(run_m1ddc, ["display", display, "get", "luminance"])
    return int(raw.strip())


async def _external_set_luminance(display: str, level: int) -> None:
    await asyncio.to_thread(
        run_m1ddc, ["display", display, "set", "luminance", str(_clamp(level))]
    )


@log_timing("brightness.up")
async def brightness_up(display: str = BUILTIN) -> None:
    if display == BUILTIN:
        await asyncio.to_thread(run_hs, lua.brightness_up(settings.VOLUME_STEP))
        return
    current = await _external_get_luminance(display)
    await _external_set_luminance(display, current + settings.BRIGHTNESS_STEP)


@log_timing("brightness.down")
async def brightness_down(display: str = BUILTIN) -> None:
    if display == BUILTIN:
        await asyncio.to_thread(run_hs, lua.brightness_down(settings.VOLUME_STEP))
        return
    current = await _external_get_luminance(display)
    await _external_set_luminance(display, current - settings.BRIGHTNESS_STEP)


@log_timing("brightness.set")
async def brightness_set(level: int, display: str = BUILTIN) -> None:
    if display == BUILTIN:
        await asyncio.to_thread(run_hs, lua.brightness_set(_clamp(level)))
        return
    await _external_set_luminance(display, level)
