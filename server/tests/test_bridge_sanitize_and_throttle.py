"""Regression tests from live-Mac E2E findings (2026-07-15):

1. `hs -c` interleaves `-- Loading extension:` console chatter into stdout,
   which broke JSON parsing of /status -> _sanitize must strip it.
2. An error storm (Hammerspoon down) fired one Discord embed per 5xx and
   hammered the channel -> alerts are throttled per-key and globally.
"""

import time

from common_helper import discord_alert
from common_helper.hs_bridge import _sanitize


def test_sanitize_strips_extension_chatter():
    raw = (
        "-- Loading extension: audiodevice\n"
        "-- Loading extension: json\n"
        '{"muted":false,"brightness":47,"volume":100,"battery":100}\n'
    )
    assert _sanitize(raw) == '{"muted":false,"brightness":47,"volume":100,"battery":100}'


def test_sanitize_plain_and_empty():
    assert _sanitize("true\n") == "true"
    assert _sanitize("") == ""
    assert _sanitize("-- Loading extension: json\n") == ""


def _reset_throttle():
    discord_alert._last_sent_by_key.clear()
    discord_alert._last_sent_global = 0.0
    discord_alert._suppressed_count = 0


def test_alert_throttles_identical_spam(monkeypatch):
    _reset_throttle()
    sent: list[dict] = []
    monkeypatch.setattr(discord_alert.settings, "DISCORD_WEBHOOK_URL", "https://example.test/hook")

    async def fake_post(embed):
        sent.append(embed)

    monkeypatch.setattr(discord_alert, "_post", fake_post)

    for _ in range(10):
        discord_alert.alert("hs_bridge", "GET /status | hs timed out")
    assert len(sent) == 1
    assert discord_alert._suppressed_count == 9


def test_alert_global_interval_spaces_distinct_errors(monkeypatch):
    _reset_throttle()
    sent: list[dict] = []
    monkeypatch.setattr(discord_alert.settings, "DISCORD_WEBHOOK_URL", "https://example.test/hook")

    async def fake_post(embed):
        sent.append(embed)

    monkeypatch.setattr(discord_alert, "_post", fake_post)

    discord_alert.alert("error A", "one")
    discord_alert.alert("error B", "two")  # distinct key, but inside global interval
    assert len(sent) == 1

    # after the global window passes, distinct errors go through again
    discord_alert._last_sent_global = time.monotonic() - discord_alert.GLOBAL_MIN_INTERVAL_S - 1
    discord_alert.alert("error B", "two")
    assert len(sent) == 2
    # and the suppression counter is surfaced on the next delivered alert
    assert "suppressed" in sent[1]["description"]


def test_lifecycle_bypasses_throttle(monkeypatch):
    _reset_throttle()
    sent: list[dict] = []
    monkeypatch.setattr(discord_alert.settings, "DISCORD_WEBHOOK_URL", "https://example.test/hook")

    async def fake_post(embed):
        sent.append(embed)

    monkeypatch.setattr(discord_alert, "_post", fake_post)

    discord_alert.send_lifecycle("server online v0.0.1")
    discord_alert.send_lifecycle("server online v0.0.1")
    assert len(sent) == 2
