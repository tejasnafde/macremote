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
_blackout_lock = asyncio.Lock()


@log_timing("system.blackout")
async def blackout() -> None:
    """Volume 0 + brightness 0 on every display; the Mac stays awake."""
    global _blackout_snapshot
    from common_helper.ddc_bridge import DDCError, run_m1ddc
    from common_helper.hs_bridge import HSError
    from handler import brightness_handler
    from handler.displays_handler import _external_brightness, _external_displays

    async with _blackout_lock:
        externals = await _external_displays()
        if _blackout_snapshot is None:
            snapshot: dict = {"volume": None, "brightness": None, "external": {}}
            try:
                snapshot["volume"] = int(
                    float(await asyncio.to_thread(run_hs, lua.VOLUME_GET))
                )
            except (HSError, ValueError):
                pass
            try:
                raw = await asyncio.to_thread(run_hs, lua.BRIGHTNESS_GET)
                snapshot["brightness"] = None if raw == "null" else int(raw)
            except (HSError, ValueError):
                pass

            for display in externals:
                name = display["name"]
                method = brightness_handler.get_method(name)
                level = (
                    brightness_handler.get_gamma_level(name)
                    if method == "gamma"
                    else await _external_brightness(display["index"])
                )
                snapshot["external"][str(display["index"])] = {
                    "name": name,
                    "method": method,
                    "level": level,
                }
            _blackout_snapshot = snapshot

        await asyncio.to_thread(run_hs, lua.BLACKOUT)
        for display in externals:
            name = display["name"]
            index = str(display["index"])
            record = _blackout_snapshot["external"].get(index, {})
            method = record.get("method", brightness_handler.get_method(name))
            if method == "gamma":
                try:
                    await asyncio.to_thread(run_hs, lua.gamma_set(name, 0))
                    brightness_handler.gamma_levels[name] = 0
                except HSError:
                    pass
                continue
            try:
                await asyncio.to_thread(
                    run_m1ddc, ["display", index, "set", "luminance", "0"]
                )
            except DDCError:
                # DDC can report success without changing the monitor; gamma
                # is the reliable fallback and must also be used for blackout.
                try:
                    record.update(
                        method="gamma",
                        level=brightness_handler.get_gamma_level(name),
                    )
                    await asyncio.to_thread(run_hs, lua.gamma_set(name, 0))
                    brightness_handler.gamma_levels[name] = 0
                except HSError:
                    pass


@log_timing("system.screens_on")
async def screens_on() -> None:
    """Undo blackout: restore what it dimmed, or sane defaults (vol 40, bright 60)."""
    from common_helper.ddc_bridge import DDCError, run_m1ddc
    from common_helper.hs_bridge import HSError
    from handler import brightness_handler
    from handler.displays_handler import _external_displays

    global _blackout_snapshot
    async with _blackout_lock:
        snap = _blackout_snapshot or {
            "volume": None,
            "brightness": None,
            "external": {},
        }
        volume = snap.get("volume")
        brightness = snap.get("brightness")
        volume = 40 if volume is None else volume
        brightness = 60 if brightness is None else brightness

        try:
            await asyncio.to_thread(run_hs, lua.volume_set(volume))
            await asyncio.to_thread(run_hs, lua.brightness_set(brightness))
        except HSError:
            pass
        for display in await _external_displays():
            index = str(display["index"])
            record = snap.get("external", {}).get(index, {})
            name = record.get("name", display["name"])
            method = record.get("method", brightness_handler.get_method(name))
            level = record.get("level")
            level = 60 if level is None else level
            if method == "gamma":
                try:
                    await asyncio.to_thread(run_hs, lua.gamma_set(name, level))
                    brightness_handler.gamma_levels[name] = level
                except HSError:
                    pass
                continue
            try:
                await asyncio.to_thread(
                    run_m1ddc,
                    ["display", index, "set", "luminance", str(level)],
                )
            except DDCError:
                pass
        _blackout_snapshot = None
