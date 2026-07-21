"""Brightness handlers - relative up/down and absolute set, for the built-in
panel (via Hammerspoon's hs.brightness) or an external display. `display` is
"builtin" (default) or an external display id, which is the index m1ddc
reports in `display list` (e.g. "1").

External displays try DDC/CI (m1ddc) first - real backlight control - and
fall back to per-display GAMMA dimming (hs.screen:setGamma) when DDC fails,
which works over any cable at the cost of the backlight staying on. Gamma
levels live in-memory per display NAME (100 = undimmed) and are clamped to a
15 floor so the screen never goes fully black under remote control."""

import asyncio

from common_helper import lua_snippets as lua
from common_helper.ddc_bridge import DDCError, parse_display_list, run_m1ddc
from common_helper.decorators import log_timing
from common_helper.hs_bridge import HSError, run_hs
from config.settings import settings

BUILTIN = "builtin"

# In-memory gamma level per external display NAME (0-100, 100 = no dimming).
# Reset on server restart, which matches macOS resetting gamma tables itself
# on display reconfiguration.
gamma_levels: dict[str, int] = {}

# Per-display dimming method by NAME: "gamma" (framebuffer, works over ANY
# cable and on monitors that silently ignore DDC) or "ddc" (true backlight,
# only for monitors that actually honor it). Default is gamma because m1ddc's
# `set` exits 0 even when the monitor ignores it, so DDC "success" is a lie we
# cannot detect: gamma always visibly works. A user with a real DDC monitor can
# opt that display into "ddc" via PUT /displays/{id}/method.
display_methods: dict[str, str] = {}
DEFAULT_METHOD = "gamma"

GAMMA_FLOOR = 15  # never fully black: the user must keep seeing the screen


def get_gamma_level(display_name: str) -> int:
    return gamma_levels.get(display_name, 100)


def get_method(display_name: str) -> str:
    return display_methods.get(display_name, DEFAULT_METHOD)


def set_method(display_name: str, method: str) -> None:
    display_methods[display_name] = "ddc" if method == "ddc" else "gamma"


def _clamp(level: int) -> int:
    return max(0, min(100, level))


def _clamp_gamma(level: int) -> int:
    return max(GAMMA_FLOOR, min(100, level))


async def _external_get_luminance(display: str) -> int:
    raw = await asyncio.to_thread(run_m1ddc, ["display", display, "get", "luminance"])
    return int(raw.strip())


async def _external_set_luminance(display: str, level: int) -> None:
    await asyncio.to_thread(
        run_m1ddc, ["display", display, "set", "luminance", str(_clamp(level))]
    )


async def _external_name(display: str) -> str:
    """Resolve an m1ddc display index to its monitor name (used to address the
    same screen through Hammerspoon for gamma). Raises DDCError when even the
    list is unavailable - then both control paths are genuinely dead."""
    raw = await asyncio.to_thread(run_m1ddc, ["display", "list"])
    for disp in parse_display_list(raw):
        if str(disp["index"]) == str(display):
            return disp["name"]
    raise DDCError(f"no external display at m1ddc index {display!r}")


async def _gamma_fallback(display: str, *, delta: int = 0, absolute: int | None = None) -> str:
    """Apply gamma dimming for `display` (m1ddc index). Adjusts the stored
    level by delta, or sets it absolutely, clamped to GAMMA_FLOOR..100.
    Raises DDCError when this path fails too, so the router degrades to
    display_unsupported instead of a 502."""
    name = await _external_name(display)
    level = _clamp_gamma(absolute if absolute is not None else get_gamma_level(name) + delta)
    try:
        await asyncio.to_thread(run_hs, lua.gamma_set(name, level))
    except HSError as exc:
        raise DDCError(f"gamma fallback failed for {name!r}: {exc}") from exc
    gamma_levels[name] = level
    return "gamma"


async def _external_step(display: str, delta: int) -> str:
    # Gamma by default (always works); DDC only if this display was opted in.
    name = await _external_name(display)
    if get_method(name) == "gamma":
        return await _gamma_fallback(display, delta=delta)
    try:
        current = await _external_get_luminance(display)
        await _external_set_luminance(display, current + delta)
        return "ddc"
    except DDCError:
        return await _gamma_fallback(display, delta=delta)


@log_timing("brightness.up")
async def brightness_up(display: str = BUILTIN) -> str | None:
    if display == BUILTIN:
        await asyncio.to_thread(run_hs, lua.brightness_up(settings.VOLUME_STEP))
        return None
    return await _external_step(display, settings.BRIGHTNESS_STEP)


@log_timing("brightness.down")
async def brightness_down(display: str = BUILTIN) -> str | None:
    if display == BUILTIN:
        await asyncio.to_thread(run_hs, lua.brightness_down(settings.VOLUME_STEP))
        return None
    return await _external_step(display, -settings.BRIGHTNESS_STEP)


@log_timing("brightness.set")
async def brightness_set(level: int, display: str = BUILTIN) -> str | None:
    if display == BUILTIN:
        await asyncio.to_thread(run_hs, lua.brightness_set(_clamp(level)))
        return None
    name = await _external_name(display)
    if get_method(name) == "gamma":
        return await _gamma_fallback(display, absolute=level)
    try:
        await _external_set_luminance(display, level)
        return "ddc"
    except DDCError:
        return await _gamma_fallback(display, absolute=level)
