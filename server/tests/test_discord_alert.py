import pytest

from common_helper import discord_alert
from config.settings import settings


def test_alert_noop_when_webhook_unset(monkeypatch):
    monkeypatch.setattr(settings, "DISCORD_WEBHOOK_URL", "")
    called = []
    monkeypatch.setattr(discord_alert, "_post", lambda embed: called.append(embed))

    discord_alert.alert(title="should not send")

    assert called == []


def test_send_lifecycle_noop_when_webhook_unset(monkeypatch):
    monkeypatch.setattr(settings, "DISCORD_WEBHOOK_URL", "")
    called = []
    monkeypatch.setattr(discord_alert, "_post", lambda embed: called.append(embed))

    discord_alert.send_lifecycle("server online v0.0.1")

    assert called == []


@pytest.mark.asyncio
async def test_post_swallows_httpx_errors(monkeypatch):
    # Nothing listens on this port - the POST must fail internally without raising.
    monkeypatch.setattr(settings, "DISCORD_WEBHOOK_URL", "http://127.0.0.1:1")
    await discord_alert._post({"title": "unreachable"})


def test_alert_does_not_raise_with_no_running_loop_and_unreachable_webhook(monkeypatch):
    # Sync context - no running event loop. alert() falls back to asyncio.run(),
    # which drives _post() to completion; the resulting connection error must be
    # swallowed, never propagated to the caller.
    monkeypatch.setattr(settings, "DISCORD_WEBHOOK_URL", "http://127.0.0.1:1")
    discord_alert.alert(title="unreachable")
