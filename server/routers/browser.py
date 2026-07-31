"""Browser tab bridge - the companion WebExtension reports its tab list here
and drains queued commands; the app enqueues per-tab commands here."""

import asyncio
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, model_validator

from common_helper import lua_snippets as lua
from common_helper.auth import require_bearer_token
from common_helper.hs_bridge import HSError, run_hs
from handler import browser_sessions

router = APIRouter(
    prefix="/browser",
    tags=["browser"],
    dependencies=[Depends(require_bearer_token)],
)

BrowserName = Literal["firefox", "chrome"]
# play/pause are absolute; playpause is the legacy toggle, kept so an older app
# build keeps working. Prefer the absolute pair: a toggle resolved seconds after
# the tap cannot be reconciled with the icon the phone already drew.
CommandAction = Literal["play", "pause", "playpause", "focus", "mute", "seek", "setvolume"]


class TabIn(BaseModel):
    tab_id: int
    title: str = ""
    url_host: str = ""
    audible: bool = False
    muted: bool = False
    playing: bool = False
    volume: int | None = None  # media element volume 0-100, when readable
    active: bool = False  # is the selected tab in its window
    fullscreen: bool = False


class ReportBody(BaseModel):
    browser: BrowserName
    tabs: list[TabIn]


class BrowserBody(BaseModel):
    browser: BrowserName


class CommandBody(BaseModel):
    action: CommandAction
    browser: BrowserName
    # seek: delta in seconds (any sign); setvolume: absolute 0-100 (required)
    value: int | None = None

    @model_validator(mode="after")
    def _validate_value(self) -> "CommandBody":
        if self.action == "setvolume":
            if self.value is None:
                raise ValueError("setvolume requires a value (0-100)")
            if not 0 <= self.value <= 100:
                raise ValueError("setvolume value must be 0-100")
        return self


@router.post("/report")
async def report(body: ReportBody) -> dict:
    browser_sessions.registry.report(body.browser, [tab.model_dump() for tab in body.tabs])
    return {"ok": True, "count": len(body.tabs)}


@router.get("/commands")
async def get_commands(browser: BrowserName = Query(...)) -> dict:
    return {"commands": browser_sessions.registry.drain_commands(browser)}


# Bundle ids for raising the browser app to the foreground on focus.
_BROWSER_BUNDLE = {"firefox": "org.mozilla.firefox", "chrome": "com.google.Chrome"}


@router.post("/tabs/{tab_id}/command")
async def enqueue_command(tab_id: int, body: CommandBody) -> dict:
    command = browser_sessions.registry.enqueue_command(body.browser, tab_id, body.action, body.value)
    # On focus, also raise the browser app itself: the extension switches the
    # tab, but macOS will not let a backgrounded browser foreground itself, so
    # the Mac does it (handles whichever display the window is on). Best effort.
    if body.action == "focus":
        bundle = _BROWSER_BUNDLE.get(body.browser)
        if bundle:
            try:
                await asyncio.to_thread(run_hs, lua.raise_app_if_running(bundle))
            except HSError:
                pass
    return {"ok": True, "command": command}


# Wait for the extension to confirm the tab went active before sending the key.
# It reports immediately after running a command, so this normally resolves well
# inside a second.
_FULLSCREEN_ACK_TIMEOUT_S = 6.0
_FULLSCREEN_ACK_POLL_S = 0.2

# Keep strong refs: a bare asyncio.create_task result can be garbage collected.
_background_tasks: set[asyncio.Task] = set()
# One waiter per tab. Two quick taps used to start two waiters that both sent
# "f", which toggles, so the pair cancelled out.
_fullscreen_pending: set[str] = set()


def _spawn(coro) -> None:
    task = asyncio.create_task(coro)
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


async def _fullscreen_after_switch(browser: str, tab_id: int, since: float) -> None:
    """Send 'f' once the target tab reports itself active in a report NEWER than
    the queued focus command. A real OS keystroke (unlike an injected click)
    carries the user activation browsers require for video fullscreen.

    `since` is what makes this an ack rather than a guess. Reports are up to 5s
    apart, so the tab could already be flagged active by a snapshot taken before
    the command existed; trusting that sent the key while the browser was still
    showing the previous tab, which is the very race this replaced.

    If no fresh report arrives, send NOTHING. "f" is a real system-wide keystroke,
    so a blind fallback types the letter into whatever app happens to be focused.
    """
    key = f"{browser}:{tab_id}"
    loop = asyncio.get_running_loop()
    deadline = loop.time() + _FULLSCREEN_ACK_TIMEOUT_S
    try:
        while loop.time() < deadline:
            tab = browser_sessions.registry.get_tab(browser, tab_id)
            if tab and tab["updated_at"] > since:
                if not tab["active"]:
                    return  # the switch did not take, so do not aim a key at it
                # "f" toggles, so pressing it on an already-fullscreen video exits.
                if tab["fullscreen"]:
                    return
                try:
                    await asyncio.to_thread(run_hs, lua.key_press("f"))
                except HSError:
                    pass
                return
            await asyncio.sleep(_FULLSCREEN_ACK_POLL_S)
    finally:
        _fullscreen_pending.discard(key)


@router.post("/tabs/{tab_id}/fullscreen")
async def fullscreen_tab(tab_id: int, body: BrowserBody) -> dict:
    """Switch to a tab and take its video fullscreen: activate the tab
    (extension), raise the browser (Hammerspoon), then send a real 'f' key once
    the extension confirms the tab is active. Returns immediately."""
    key = f"{body.browser}:{tab_id}"
    if key in _fullscreen_pending:
        return {"ok": True, "note": "fullscreen already pending"}

    # Take the clock reading BEFORE queueing, so only a report that lands after
    # this point can satisfy the ack.
    since = browser_sessions.registry.now()
    browser_sessions.registry.enqueue_command(body.browser, tab_id, "focus")

    bundle = _BROWSER_BUNDLE.get(body.browser)
    if bundle:
        try:
            # This returns "not-running" when the browser is not up. Believe it:
            # otherwise the waiter would time out and, previously, still fire a
            # stray "f" at the frontmost app.
            raised = await asyncio.to_thread(run_hs, lua.raise_app_if_running(bundle))
            if (raised or "").strip() == "not-running":
                return {"ok": False, "note": f"{body.browser} is not running"}
        except HSError:
            pass

    _fullscreen_pending.add(key)
    _spawn(_fullscreen_after_switch(body.browser, tab_id, since))
    return {"ok": True, "note": "fullscreen requested"}
