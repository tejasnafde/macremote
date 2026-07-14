"""Fire-and-forget Discord alerts. No-ops when DISCORD_WEBHOOK_URL is unset;
never raises, even if the webhook call itself fails (bad URL, network down, etc.)."""

import asyncio
import time
from datetime import datetime, timezone

import httpx

from app_util.log_util import errorlogger, infologger
from config.settings import settings

# ── Throttling ────────────────────────────────────────────────────────────────
# Error storms (e.g. Hammerspoon down while something polls /status) must not
# hammer the Discord channel: identical alerts get a per-key cooldown, and
# everything but lifecycle events shares a global minimum interval.
PER_KEY_COOLDOWN_S = 120.0
GLOBAL_MIN_INTERVAL_S = 15.0
_last_sent_by_key: dict[str, float] = {}
_last_sent_global = 0.0
_suppressed_count = 0


def _throttled(key: str) -> bool:
    """Return True (and count a suppression) if this alert should be dropped."""
    global _last_sent_global, _suppressed_count
    now = time.monotonic()
    if now - _last_sent_by_key.get(key, -10**9) < PER_KEY_COOLDOWN_S:
        _suppressed_count += 1
        return True
    if now - _last_sent_global < GLOBAL_MIN_INTERVAL_S:
        _suppressed_count += 1
        return True
    _last_sent_by_key[key] = now
    _last_sent_global = now
    return False


async def _post(embed: dict) -> None:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                settings.DISCORD_WEBHOOK_URL,
                json={"username": "macremote", "embeds": [embed]},
            )
    except Exception as exc:
        errorlogger.error(f"discord_alert | delivery failed | {exc}")


def alert(title: str, description: str = "", color: int = 0xE53E3E, throttle: bool = True) -> None:
    """Schedule a Discord alert embed. Safe to call from sync or async code;
    no-op if the webhook is not configured; never raises. Repeated identical
    alerts are throttled (see PER_KEY_COOLDOWN_S / GLOBAL_MIN_INTERVAL_S)."""
    global _suppressed_count
    if not settings.DISCORD_WEBHOOK_URL:
        return

    if throttle and _throttled(f"{title}|{description[:120]}"):
        infologger.info(f"discord_alert | throttled | {title}")
        return

    if _suppressed_count:
        description = f"{description}\n\n(+{_suppressed_count} similar alert(s) suppressed)"
        _suppressed_count = 0

    embed = {
        "title": title,
        "description": description[:3900] if description else "",
        "color": color,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_post(embed))
    except RuntimeError:
        # No running event loop (e.g. called from sync code/tests) - best effort, still safe.
        try:
            asyncio.run(_post(embed))
        except Exception as exc:
            errorlogger.error(f"discord_alert | delivery failed | {exc}")


def send_lifecycle(message: str, color: int = 0x3498DB) -> None:
    """Convenience wrapper for lifecycle events: server start, sleep-timer fired, etc.
    Lifecycle events are intentional one-offs and bypass throttling."""
    alert(title="macremote", description=message, color=color, throttle=False)
