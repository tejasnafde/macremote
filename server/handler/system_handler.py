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


# What blackout dimmed, so screens_on can restore instead of guessing.
_blackout_snapshot: dict | None = None


@log_timing("system.blackout")
async def blackout() -> None:
    """Volume 0 + brightness 0 on every display; the Mac stays awake."""
    global _blackout_snapshot
    from common_helper.ddc_bridge import DDCError, run_m1ddc
    from common_helper.hs_bridge import HSError
    from handler.displays_handler import _external_brightness, _external_displays

    snapshot: dict = {"volume": None, "brightness": None, "external": {}}
    try:
        snapshot["volume"] = int(float(await asyncio.to_thread(run_hs, lua.VOLUME_GET)))
    except (HSError, ValueError):
        pass
    try:
        raw = await asyncio.to_thread(run_hs, lua.BRIGHTNESS_GET)
        snapshot["brightness"] = None if raw == "null" else int(raw)
    except (HSError, ValueError):
        pass

    externals = await _external_displays()
    for d in externals:
        snapshot["external"][d["index"]] = await _external_brightness(d["index"])
    _blackout_snapshot = snapshot

    await asyncio.to_thread(run_hs, lua.BLACKOUT)
    for d in externals:
        try:
            await asyncio.to_thread(
                run_m1ddc, ["display", str(d["index"]), "set", "luminance", "0"]
            )
        except DDCError:
            pass  # best effort: a monitor without DDC keeps its brightness


@log_timing("system.screens_on")
async def screens_on() -> None:
    """Undo blackout: restore what it dimmed, or sane defaults (vol 40, bright 60)."""
    from common_helper.ddc_bridge import DDCError, run_m1ddc
    from common_helper.hs_bridge import HSError
    from handler.displays_handler import _external_displays

    snap = _blackout_snapshot or {"volume": None, "brightness": None, "external": {}}
    volume = snap.get("volume") if snap.get("volume") else 40
    brightness = snap.get("brightness") if snap.get("brightness") else 60

    try:
        await asyncio.to_thread(run_hs, lua.volume_set(volume))
        await asyncio.to_thread(run_hs, lua.brightness_set(brightness))
    except HSError:
        pass
    for d in await _external_displays():
        level = snap.get("external", {}).get(d["index"]) or 60
        try:
            await asyncio.to_thread(
                run_m1ddc, ["display", str(d["index"]), "set", "luminance", str(level)]
            )
        except DDCError:
            pass
