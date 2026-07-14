"""Sleep timer - a pure-Python asyncio task (NOT implemented in Hammerspoon).

Schedules the Mac to sleep `minutes` from now. Over the final FADE_WINDOW_SECONDS
seconds it fades volume down in FADE_STEPS steps via the Hammerspoon bridge, then
sends the sleep command and fires a Discord lifecycle alert.

Delays and the hs/alert calls are injectable so tests can run this instantly.
"""

import asyncio
import time

from app_util.log_util import errorlogger, infologger
from common_helper import lua_snippets as lua
from common_helper.discord_alert import send_lifecycle
from common_helper.hs_bridge import HSError, run_hs

FADE_WINDOW_SECONDS = 60
FADE_STEPS = 6
FADE_STEP_PERCENT = max(1, 100 // FADE_STEPS)


class SleepTimerService:
    """One timer at a time; starting a new one cancels any in-flight timer."""

    def __init__(self, sleep_fn=asyncio.sleep, run_hs_fn=run_hs, alert_fn=send_lifecycle):
        self._sleep = sleep_fn
        self._run_hs = run_hs_fn
        self._alert = alert_fn
        self._task: asyncio.Task | None = None
        self._deadline: float | None = None  # time.monotonic() timestamp when it fires

    def is_active(self) -> bool:
        return self._task is not None and not self._task.done()

    def remaining_seconds(self) -> int | None:
        if not self.is_active() or self._deadline is None:
            return None
        return max(0, round(self._deadline - time.monotonic()))

    def start(self, minutes: int) -> None:
        self.cancel()
        total_seconds = minutes * 60
        self._deadline = time.monotonic() + total_seconds
        self._task = asyncio.create_task(self._run(total_seconds))

    def cancel(self) -> bool:
        """Cancel any in-flight timer. Returns True if one was actually running."""
        was_active = self.is_active()
        if self._task is not None:
            self._task.cancel()
        self._task = None
        self._deadline = None
        return was_active

    async def _run(self, total_seconds: int) -> None:
        try:
            fade_window = min(FADE_WINDOW_SECONDS, total_seconds)
            pre_fade = total_seconds - fade_window
            if pre_fade > 0:
                await self._sleep(pre_fade)

            step_interval = fade_window / FADE_STEPS if FADE_STEPS else 0
            for _ in range(FADE_STEPS):
                try:
                    await asyncio.to_thread(self._run_hs, lua.volume_down(FADE_STEP_PERCENT))
                except HSError as exc:
                    errorlogger.error(f"sleep_timer | fade step failed | {exc}")
                if step_interval:
                    await self._sleep(step_interval)

            try:
                await asyncio.to_thread(self._run_hs, lua.SLEEP)
            except HSError as exc:
                errorlogger.error(f"sleep_timer | sleep command failed | {exc}")

            infologger.info("sleep_timer | fired")
            self._alert("sleep timer fired")
        except asyncio.CancelledError:
            infologger.info("sleep_timer | cancelled")
            raise
        finally:
            self._deadline = None


sleep_timer_service = SleepTimerService()
