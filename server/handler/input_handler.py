"""Generic input handlers for reading mode: scroll the frontmost app and send
page-turn / navigation keys. One surface drives browser manga/novels and
Readest alike, since it just synthesizes scroll + key events at the OS level."""

import asyncio

from common_helper import lua_snippets as lua
from common_helper.decorators import log_timing
from common_helper.hs_bridge import run_hs


class UnknownKeyError(Exception):
    """Raised when a key outside the allowlist is requested."""


@log_timing("input.scroll")
async def scroll(dx: int, dy: int) -> None:
    await asyncio.to_thread(run_hs, lua.scroll_event(dx, dy))


@log_timing("input.key")
async def press_key(key: str) -> None:
    key = key.lower()
    if key not in lua.KEY_STROKES:
        raise UnknownKeyError(key)
    await asyncio.to_thread(run_hs, lua.key_press(key))
