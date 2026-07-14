"""macremote server entrypoint.

Run (dev): `uv run uvicorn main:app --reload --host 0.0.0.0 --port 8484`
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app_util.log_util import errorlogger, infologger
from common_helper.discord_alert import alert, send_lifecycle
from common_helper.hs_bridge import HSError
from common_helper.version import get_version
from handler.sleep_timer_handler import sleep_timer_service
from routers import brightness, media, meta, sleep_timer, status, system, volume


@asynccontextmanager
async def lifespan(app: FastAPI):
    version = get_version()
    infologger.info(f"macremote server online v{version}")
    send_lifecycle(f"server online v{version}")
    yield
    sleep_timer_service.cancel()


app = FastAPI(title="macremote", version=get_version(), lifespan=lifespan)

app.include_router(meta.router)
app.include_router(media.router)
app.include_router(volume.router)
app.include_router(brightness.router)
app.include_router(system.router)
app.include_router(sleep_timer.router)
app.include_router(status.router)


@app.exception_handler(HSError)
async def hs_error_handler(request: Request, exc: HSError) -> JSONResponse:
    errorlogger.error(f"hs_bridge | {request.method} {request.url.path} | {exc}")
    alert(
        title=f"502 {request.method} {request.url.path}",
        description=f"Hammerspoon bridge failed: {exc}",
    )
    return JSONResponse(status_code=502, content={"error": "hammerspoon bridge failed"})


@app.middleware("http")
async def error_middleware(request: Request, call_next):
    """Catches anything that fell through routing/handlers unhandled - logs,
    fires a Discord alert (fire-and-forget, never blocks/raises), and returns
    a clean JSON error instead of leaking a traceback to the client."""
    try:
        return await call_next(request)
    except Exception as exc:  # noqa: BLE001 - intentional catch-all safety net
        errorlogger.error(
            f"unhandled | {request.method} {request.url.path} | {exc}", exc_info=True
        )
        alert(
            title=f"500 {request.method} {request.url.path}",
            description=str(exc),
        )
        return JSONResponse(status_code=500, content={"error": "internal server error"})
