"""Reading-mode input: scroll the frontmost app and send page-turn keys."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from common_helper.auth import require_bearer_token
from handler import input_handler

router = APIRouter(
    prefix="/input",
    tags=["input"],
    dependencies=[Depends(require_bearer_token)],
)


class ScrollBody(BaseModel):
    dx: int = Field(0, ge=-4000, le=4000)
    dy: int = Field(0, ge=-4000, le=4000)


class KeyBody(BaseModel):
    key: str


@router.post("/scroll")
async def scroll(body: ScrollBody) -> dict:
    if body.dx == 0 and body.dy == 0:
        return {"ok": True}
    await input_handler.scroll(body.dx, body.dy)
    return {"ok": True}


@router.post("/key")
async def press_key(body: KeyBody) -> dict:
    try:
        await input_handler.press_key(body.key)
    except input_handler.UnknownKeyError:
        raise HTTPException(status_code=422, detail=f"unsupported key: {body.key}")
    return {"ok": True}
