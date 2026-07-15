"""Browser tab bridge - the companion WebExtension reports its tab list here
and drains queued commands; the app enqueues per-tab commands here."""

from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from common_helper.auth import require_bearer_token
from handler import browser_sessions

router = APIRouter(
    prefix="/browser",
    tags=["browser"],
    dependencies=[Depends(require_bearer_token)],
)

BrowserName = Literal["firefox", "chrome"]
CommandAction = Literal["playpause", "focus", "mute"]


class TabIn(BaseModel):
    tab_id: int
    title: str = ""
    url_host: str = ""
    audible: bool = False
    muted: bool = False
    playing: bool = False


class ReportBody(BaseModel):
    browser: BrowserName
    tabs: list[TabIn]


class CommandBody(BaseModel):
    action: CommandAction
    browser: BrowserName


@router.post("/report")
async def report(body: ReportBody) -> dict:
    browser_sessions.registry.report(body.browser, [tab.model_dump() for tab in body.tabs])
    return {"ok": True, "count": len(body.tabs)}


@router.get("/commands")
async def get_commands(browser: BrowserName = Query(...)) -> dict:
    return {"commands": browser_sessions.registry.drain_commands(browser)}


@router.post("/tabs/{tab_id}/command")
async def enqueue_command(tab_id: int, body: CommandBody) -> dict:
    command = browser_sessions.registry.enqueue_command(body.browser, tab_id, body.action)
    return {"ok": True, "command": command}
