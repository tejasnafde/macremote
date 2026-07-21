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
CommandAction = Literal["playpause", "focus", "mute", "seek", "setvolume"]


class TabIn(BaseModel):
    tab_id: int
    title: str = ""
    url_host: str = ""
    audible: bool = False
    muted: bool = False
    playing: bool = False
    volume: int | None = None  # media element volume 0-100, when readable


class ReportBody(BaseModel):
    browser: BrowserName
    tabs: list[TabIn]


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
                await asyncio.to_thread(run_hs, lua.focus_app(bundle))
            except HSError:
                pass
    return {"ok": True, "command": command}
