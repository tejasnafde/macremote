"""Fire-and-forget Discord alerts. No-ops when DISCORD_WEBHOOK_URL is unset;
never raises, even if the webhook call itself fails (bad URL, network down, etc.)."""

import asyncio
from datetime import datetime, timezone

import httpx

from app_util.log_util import errorlogger
from config.settings import settings


async def _post(embed: dict) -> None:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                settings.DISCORD_WEBHOOK_URL,
                json={"username": "macremote", "embeds": [embed]},
            )
    except Exception as exc:
        errorlogger.error(f"discord_alert | delivery failed | {exc}")


def alert(title: str, description: str = "", color: int = 0xE53E3E) -> None:
    """Schedule a Discord alert embed. Safe to call from sync or async code;
    no-op if the webhook is not configured; never raises."""
    if not settings.DISCORD_WEBHOOK_URL:
        return

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
    """Convenience wrapper for lifecycle events: server start, sleep-timer fired, etc."""
    alert(title="macremote", description=message, color=color)
